"use server";

import { z } from "zod";
import { toRecipeDraft } from "@/lib/ai/draft";
import { ImportError } from "@/lib/ai/errors";
import { extractRecipe, type ImageMediaType } from "@/lib/ai/extract-recipe";
import type { AiRecipe } from "@/lib/ai/schemas";
import { loadWebSource } from "@/lib/ai/web-source";
import { requireUser } from "@/lib/auth-server";
import { RECIPE_IMAGES_BUCKET, type SourceType } from "@/lib/recipes/constants";
import type { RecipeDraft } from "@/lib/recipes/draft";

export type ImportResult =
  | { ok: true; draft: RecipeDraft; sourceType: SourceType; note: string | null }
  | { ok: false; error: string };

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
const pathsSchema = z
  .array(z.string().max(300))
  .min(1, "Añade al menos una foto.")
  .max(3, "Máximo 3 fotos por receta.");

async function run(
  work: () => Promise<{ ai: AiRecipe; sourceType: SourceType; sourceUrl?: string; note?: string }>,
): Promise<ImportResult> {
  try {
    const { ai, sourceType, sourceUrl, note } = await work();
    const draft = toRecipeDraft(ai, sourceUrl ?? null);
    if (!ai.is_recipe || (draft.ingredients.length === 0 && draft.steps.length === 0)) {
      return { ok: false, error: "No parece que ahí haya una receta." };
    }
    return { ok: true, draft, sourceType, note: note ?? null };
  } catch (error) {
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

export async function importFromUrl(input: unknown): Promise<ImportResult> {
  await requireUser();
  const parsed = urlSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  return run(async () => {
    const source = await loadWebSource(parsed.data);
    return {
      ai: await extractRecipe({ kind: "text", text: source.text }),
      sourceType: "url" as const,
      sourceUrl: source.finalUrl,
      note: source.truncated
        ? "La página es muy larga y solo se ha leído el principio. Comprueba que no falte nada."
        : undefined,
    };
  });
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
