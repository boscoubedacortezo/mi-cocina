"use server";

import { z } from "zod";
import { toRecipeDraft } from "@/lib/ai/draft";
import { ImportError } from "@/lib/ai/errors";
import { extractRecipe, type ImageMediaType } from "@/lib/ai/extract-recipe";
import type { AiRecipe } from "@/lib/ai/schemas";
import { loadWebSource } from "@/lib/ai/web-source";
import { requireUser } from "@/lib/auth-server";
import { RECIPE_IMAGES_BUCKET, type SourceType } from "@/lib/recipes/constants";
import {
  extractCookidooUrl,
  isCookidooImageHost,
  isCookidooUrl,
  normalizeRecipeUrl,
} from "@/lib/recipes/cookidoo-url";
import {
  SOCIAL_LABELS,
  isSocialImageHost,
  normalizeSocialUrl,
  socialPlatform,
} from "@/lib/recipes/social-url";
import type { RecipeDraft } from "@/lib/recipes/draft";

export type ImportResult =
  | {
      ok: true;
      draft: RecipeDraft;
      sourceType: SourceType;
      note: string | null;
      /** A photo to bring along when the recipe is saved (Cookidoo's own). */
      imageUrl: string | null;
    }
  | { ok: false; error: string; existingId?: string };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, ImageMediaType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

const textSchema = z
  .string()
  .trim()
  .min(40, "Pega la receta completa: hay muy poco texto.")
  .max(30_000, "El texto es demasiado largo (máximo 30.000 caracteres).");
const urlSchema = z.string().trim().min(1, "Pega una URL.").max(2000);
const transcriptSchema = z
  .string()
  .trim()
  .max(30_000, "La transcripción es demasiado larga (máximo 30.000 caracteres).");
const pathsSchema = z
  .array(z.string().max(300))
  .min(1, "Añade al menos una foto.")
  .max(3, "Máximo 3 fotos por receta.");

/** Thrown inside an import when the link is already in the library. */
class DuplicateRecipe extends Error {
  constructor(readonly recipe: { id: string; title: string }) {
    super("duplicate");
  }
}

const duplicateResult = (recipe: { id: string; title: string }): ImportResult => ({
  ok: false,
  error: `«${recipe.title}» ya está en tu recetario.`,
  existingId: recipe.id,
});

async function run(
  work: () => Promise<{
    ai: AiRecipe;
    sourceType: SourceType;
    sourceUrl?: string;
    note?: string;
    imageUrl?: string | null;
  }>,
  notRecipeMessage = "No parece que ahí haya una receta.",
): Promise<ImportResult> {
  try {
    const { ai, sourceType, sourceUrl, note, imageUrl } = await work();
    const draft = toRecipeDraft(ai, sourceUrl ?? null);
    if (!ai.is_recipe || (draft.ingredients.length === 0 && draft.steps.length === 0)) {
      return { ok: false, error: notRecipeMessage };
    }
    return { ok: true, draft, sourceType, note: note ?? null, imageUrl: imageUrl ?? null };
  } catch (error) {
    if (error instanceof DuplicateRecipe) return duplicateResult(error.recipe);
    if (error instanceof ImportError) return { ok: false, error: error.message };
    console.error("[import] unexpected error:", error);
    return { ok: false, error: "No se pudo importar la receta. Inténtalo de nuevo." };
  }
}

export async function importFromText(input: unknown): Promise<ImportResult> {
  await requireUser();
  const parsed = textSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  return run(async () => ({
    ai: await extractRecipe({ kind: "text", text: parsed.data }),
    sourceType: "texto",
  }));
}

/**
 * `transcript` is the optional spoken text of a video (e.g. from TokScript): it joins the
 * post's caption so the recipe has both the quantities and the method.
 */
export async function importFromUrl(input: unknown, transcript?: unknown): Promise<ImportResult> {
  const { supabase } = await requireUser();
  const parsed = urlSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const spoken = transcriptSchema.safeParse(transcript ?? "");
  if (!spoken.success) return { ok: false, error: spoken.error.issues[0].message };
  const spokenText = spoken.data;
  // What Cookidoo's "share" copies is a sentence with the link inside: keep only the link.
  const link = extractCookidooUrl(parsed.data);

  /** A recipe saved from the same link: reuse it instead of importing (and paying for the AI) again. */
  const existing = async (key: string) => {
    const { data } = await supabase
      .from("recipes")
      .select("id, title")
      .eq("source_url", key)
      .limit(1);
    return data?.[0] as { id: string; title: string } | undefined;
  };
  const social = socialPlatform(link);
  if (isCookidooUrl(link) || social) {
    try {
      const known = await existing(social ? normalizeSocialUrl(link) : normalizeRecipeUrl(link));
      if (known) return duplicateResult(known);
    } catch {
      // Not a valid link: loadWebSource will say so.
    }
  }

  const notRecipeMessage = social
    ? `El texto de esa publicación de ${SOCIAL_LABELS[social]} no parece una receta (quizá está solo en el vídeo). Pega el texto o sube capturas de pantalla.`
    : undefined;
  let imageUrl: string | null = null;
  return run(async () => {
    let source;
    try {
      source = await loadWebSource(link);
    } catch (error) {
      // With the transcript in hand, a post whose caption cannot be read is still usable.
      if (!(error instanceof ImportError) || !spokenText || !social) throw error;
      source = {
        kind: "social" as const,
        text: "",
        truncated: false,
        finalUrl: link,
        imageUrl: null,
      };
    }
    const fromCookidoo = isCookidooUrl(source.finalUrl);
    const fromSocial = source.kind === "social";
    // Cookidoo and social posts keep the recipe in the path; the query string is only share trackers.
    const sourceUrl = fromSocial
      ? normalizeSocialUrl(source.finalUrl)
      : fromCookidoo
        ? normalizeRecipeUrl(source.finalUrl)
        : source.finalUrl;
    if (fromCookidoo || fromSocial) {
      const known = await existing(sourceUrl);
      if (known) throw new DuplicateRecipe(known);
    }
    // The photo: Cookidoo's own, or the cover of the video. Only from the hosts that serve them.
    if (source.imageUrl) {
      const host = new URL(source.imageUrl).hostname;
      const allowed = fromCookidoo ? isCookidooImageHost(host) : fromSocial && isSocialImageHost(host);
      if (allowed) imageUrl = source.imageUrl;
    }
    const text = spokenText
      ? `${source.text}\n\nTranscripción del audio del vídeo (reconocimiento de voz automático, puede tener errores):\n${spokenText}`.trim()
      : source.text;
    return {
      ai: await extractRecipe({ kind: "text", text }),
      sourceType: "url" as const,
      sourceUrl,
      imageUrl,
      note: source.truncated
        ? "La página es muy larga y solo se ha leído el principio. Comprueba que no falte nada."
        : fromCookidoo
          ? "Cookidoo no publica los pasos: aquí quedan los ingredientes y los tiempos."
          : fromSocial
            ? spokenText
              ? "Receta hecha con el texto de la publicación y la transcripción del audio. Revisa cantidades y tiempos: la transcripción puede tener errores."
              : "Receta leída del texto de la publicación. Si los pasos solo salen en el vídeo, tendrás que completarlos."
            : undefined,
    };
  }, notRecipeMessage);
}

/**
 * Photos are uploaded to Storage by the browser first (server actions have a
 * small body limit); here they are read back, sent to Claude and deleted.
 */
export async function importFromImages(input: unknown): Promise<ImportResult> {
  const { supabase, userId } = await requireUser();
  const parsed = pathsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const paths = parsed.data;

  const validPath = (path: string) =>
    path.startsWith(`${userId}/import/`) && !path.includes("..");
  if (!paths.every(validPath)) return { ok: false, error: "Foto no válida." };

  try {
    return await run(async () => {
      const images = await Promise.all(
        paths.map(async (path) => {
          const mediaType = IMAGE_TYPES[path.split(".").pop()?.toLowerCase() ?? ""];
          if (!mediaType) {
            throw new ImportError(
              "Formato de foto no compatible. Usa JPG, PNG o WebP (las fotos HEIC no funcionan en este navegador).",
            );
          }
          const { data, error } = await supabase.storage
            .from(RECIPE_IMAGES_BUCKET)
            .download(path);
          if (error || !data) throw new ImportError("No se pudo leer la foto subida.");
          if (data.size > MAX_IMAGE_BYTES) {
            throw new ImportError("Una de las fotos pesa más de 5 MB.");
          }
          return { mediaType, data: Buffer.from(await data.arrayBuffer()).toString("base64") };
        }),
      );
      return { ai: await extractRecipe({ kind: "images", images }), sourceType: "foto" as const };
    });
  } finally {
    // Temporary files: remove them whatever the outcome.
    await supabase.storage.from(RECIPE_IMAGES_BUCKET).remove(paths);
  }
}
