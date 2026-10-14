import "server-only";
import * as cheerio from "cheerio";
import { ImportError } from "./errors";
import { fetchPublicHtml } from "./safe-fetch";

const MAX_TEXT_CHARS = 30_000;

export type WebSource = {
  /** "json-ld": structured data published by the site; "html": cleaned page text. */
  kind: "json-ld" | "html";
  text: string;
  /** True when the page text was cut to fit. */
  truncated: boolean;
  finalUrl: string;
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
    return {
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
export async function loadWebSource(url: string): Promise<WebSource> {
  const { html, finalUrl } = await fetchPublicHtml(url);
  const $ = cheerio.load(html);

  const recipe = extractJsonLdRecipe($);
  if (recipe) {
    return { kind: "json-ld", text: JSON.stringify(recipe, null, 2), truncated: false, finalUrl };
  }

  const text = cleanPageText($);
  if (text.length < 80) {
    throw new ImportError(
      "No se pudo leer contenido de esa página (puede cargarse con JavaScript). Prueba a pegar el texto de la receta.",
    );
  }
  const truncated = text.length > MAX_TEXT_CHARS;
  return { kind: "html", text: text.slice(0, MAX_TEXT_CHARS), truncated, finalUrl };
}
