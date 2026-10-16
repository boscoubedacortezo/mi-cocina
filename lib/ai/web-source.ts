import "server-only";
import * as cheerio from "cheerio";
import { SOCIAL_LABELS, socialPlatform, type SocialPlatform } from "@/lib/recipes/social-url";
import { ImportError } from "./errors";
import { fetchPublicHtml } from "./safe-fetch";

const MAX_TEXT_CHARS = 30_000;

export type WebSource = {
  /** "json-ld": structured data published by the site; "html": cleaned page text;
   * "social": the caption of an Instagram or TikTok post. */
  kind: "json-ld" | "html" | "social";
  text: string;
  /** True when the page text was cut to fit. */
  truncated: boolean;
  finalUrl: string;
  /** The recipe's photo (absolute URL) when the page declares one. */
  imageUrl: string | null;
};

type Json = unknown;

function isRecipeNode(node: Json): node is Record<string, Json> {
  if (!node || typeof node !== "object") return false;
  const type = (node as Record<string, Json>)["@type"];
  return Array.isArray(type) ? type.includes("Recipe") : type === "Recipe";
}

function findRecipe(node: Json): Record<string, Json> | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipe(item);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  if (isRecipeNode(node)) return node;
  const graph = (node as Record<string, Json>)["@graph"];
  return graph ? findRecipe(graph) : null;
}

function flattenInstructions(node: Json): string[] {
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(flattenInstructions);
  if (node && typeof node === "object") {
    const obj = node as Record<string, Json>;
    if (obj.itemListElement) return flattenInstructions(obj.itemListElement);
    if (typeof obj.text === "string") return [obj.text];
    if (typeof obj.name === "string") return [obj.name];
  }
  return [];
}

function firstImage(node: Json): string | null {
  if (typeof node === "string") return node || null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = firstImage(item);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === "object") return firstImage((node as Record<string, Json>).url);
  return null;
}

function extractJsonLdRecipe($: cheerio.CheerioAPI) {
  for (const element of $('script[type="application/ld+json"]').toArray()) {
    let data: Json;
    try {
      data = JSON.parse($(element).text());
    } catch {
      continue;
    }
    const recipe = findRecipe(data);
    if (!recipe) continue;

    const ingredients = Array.isArray(recipe.recipeIngredient)
      ? recipe.recipeIngredient.filter((i): i is string => typeof i === "string")
      : [];
    const steps = flattenInstructions(recipe.recipeInstructions);
    if (ingredients.length === 0 && steps.length === 0) continue;

    // Only the fields a recipe needs; the rest of the JSON-LD is noise.
    const fields = {
      name: recipe.name,
      description: recipe.description,
      recipeYield: recipe.recipeYield,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      totalTime: recipe.totalTime,
      recipeCategory: recipe.recipeCategory,
      recipeCuisine: recipe.recipeCuisine,
      keywords: recipe.keywords,
      recipeIngredient: ingredients,
      recipeInstructions: steps,
    };
    return { fields, image: firstImage(recipe.image) };
  }
  return null;
}

function cleanPageText($: cheerio.CheerioAPI) {
  $(
    "script, style, noscript, svg, iframe, nav, header, footer, aside, form, button, dialog, [aria-hidden='true']",
  ).remove();
  const root = $("main").first().length ? $("main").first() : $("body");
  root.find("br").replaceWith("\n");
  root.find("p, li, h1, h2, h3, h4, h5, h6, tr, div, section").each((_, el) => {
    $(el).append("\n");
  });
  const title = $("title").first().text().trim();
  const lines = root
    .text()
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return [title && `Título de la página: ${title}`, ...lines].filter(Boolean).join("\n");
}

/** Downloads a page and returns the best text to extract a recipe from. */
/** The photo the page declares: the recipe markup's, else the social-preview image. */
function resolveImage($: cheerio.CheerioAPI, fromRecipe: string | null, base: string) {
  const candidate = fromRecipe ?? $('meta[property="og:image"]').attr("content") ?? null;
  if (!candidate) return null;
  try {
    return new URL(candidate, base).toString();
  } catch {
    return null;
  }
}

const MIN_CAPTION_CHARS = 40;

/** The text between the quotes of an Instagram preview ("<author> on Instagram: "caption""). */
function instagramCaption($: cheerio.CheerioAPI) {
  const description = $('meta[property="og:description"]').attr("content") ?? "";
  const title = $('meta[property="og:title"]').attr("content") ?? "";
  const quoted = (text: string) => text.match(/:\s*"([\s\S]*)"\.?\s*$/)?.[1]?.trim() ?? "";
  const caption = quoted(description) || quoted(title);
  const author = title.match(/^(.+?) on Instagram/)?.[1]?.trim() ?? null;
  return { caption, author, image: $('meta[property="og:image"]').attr("content") ?? null };
}

/** TikTok keeps the post (caption, author) in a JSON block of the page. */
function tiktokCaption($: cheerio.CheerioAPI) {
  const raw = $("#__UNIVERSAL_DATA_FOR_REHYDRATION__").text();
  try {
    const scope = JSON.parse(raw).__DEFAULT_SCOPE__ as Record<string, unknown>;
    const detail = scope["webapp.video-detail"] as {
      itemInfo?: {
        itemStruct?: {
          desc?: string;
          author?: { uniqueId?: string; nickname?: string };
          video?: { cover?: string; originCover?: string };
        };
      };
    };
    const item = detail?.itemInfo?.itemStruct;
    return {
      caption: item?.desc?.trim() ?? "",
      author: item?.author?.nickname || item?.author?.uniqueId || null,
      // `cover` is the one the creator picked; `originCover` is just the first frame.
      image:
        item?.video?.cover ||
        $('meta[property="og:image"]').attr("content") ||
        item?.video?.originCover ||
        null,
    };
  } catch {
    return { caption: "", author: null, image: null };
  }
}

/** YouTube keeps the description of the video in the JSON of its page. */
function youtubeCaption($: cheerio.CheerioAPI, html: string) {
  const description = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)?.[1];
  let caption = "";
  try {
    caption = description ? (JSON.parse(`"${description}"`) as string).trim() : "";
  } catch {
    // Keep it empty: the caller says the text could not be read.
  }
  const title = $('meta[property="og:title"]').attr("content")?.trim() ?? "";
  return {
    caption: title && caption ? `${title}\n${caption}` : caption,
    author: null,
    image: $('meta[property="og:image"]').attr("content") ?? null,
  };
}

function socialSource(
  platform: SocialPlatform,
  $: cheerio.CheerioAPI,
  finalUrl: string,
  html: string,
): WebSource {
  const { caption, author, image } =
    platform === "instagram"
      ? instagramCaption($)
      : platform === "tiktok"
        ? tiktokCaption($)
        : youtubeCaption($, html);
  if (caption.length < MIN_CAPTION_CHARS) {
    throw new ImportError(
      `No he podido leer el texto de esa publicación de ${SOCIAL_LABELS[platform]} (o no lo trae). Pega el texto de la receta o sube capturas de pantalla.`,
    );
  }
  const header = `Publicación de ${SOCIAL_LABELS[platform]}${author ? ` de ${author}` : ""}. Texto de la publicación:`;
  return {
    kind: "social",
    text: `${header}\n${caption}`.slice(0, MAX_TEXT_CHARS),
    truncated: false,
    finalUrl,
    // The cover of the video, when the page gives one (a link that may expire: it is copied on save).
    imageUrl: image,
  };
}

export async function loadWebSource(url: string): Promise<WebSource> {
  const { html, finalUrl } = await fetchPublicHtml(url);
  const $ = cheerio.load(html);

  const platform = socialPlatform(finalUrl);
  if (platform) return socialSource(platform, $, finalUrl, html);

  const found = extractJsonLdRecipe($);
  const imageUrl = resolveImage($, found?.image ?? null, finalUrl);
  if (found) {
    return {
      kind: "json-ld",
      text: JSON.stringify(found.fields, null, 2),
      truncated: false,
      finalUrl,
      imageUrl,
    };
  }

  const text = cleanPageText($);
  if (text.length < 80) {
    throw new ImportError(
      "No se pudo leer contenido de esa página (puede cargarse con JavaScript). Prueba a pegar el texto de la receta.",
    );
  }
  const truncated = text.length > MAX_TEXT_CHARS;
  return { kind: "html", text: text.slice(0, MAX_TEXT_CHARS), truncated, finalUrl, imageUrl };
}
