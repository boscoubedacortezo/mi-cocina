"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth-server";
import { RECIPE_IMAGES_BUCKET } from "@/lib/recipes/constants";
import {
  downloadStockPhoto,
  searchStockPhotos as searchPexels,
  stockPhotosEnabled,
  type StockPhoto,
} from "@/lib/stock-photos";

export type SearchPhotosResult =
  | { ok: true; photos: StockPhoto[] }
  | { ok: false; error: string };

export type ImportPhotoResult = { ok: true; path: string } | { ok: false; error: string };

const searchSchema = z.object({
  title: z.string().trim().min(1, "Escribe primero el título de la receta.").max(150),
  tags: z.array(z.string().max(40)).max(20),
});

export async function searchStockPhotos(input: unknown): Promise<SearchPhotosResult> {
  await requireUser();
  if (!stockPhotosEnabled()) {
    return { ok: false, error: "Las fotos sugeridas no están configuradas." };
  }
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const photos = await searchPexels(parsed.data.title, parsed.data.tags[0]);
    return { ok: true, photos };
  } catch (error) {
    console.error("[stock-photos] search failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudieron buscar fotos.",
    };
  }
}

/** Copies the chosen photo into the user's private storage and returns its path. */
export async function importStockPhoto(input: unknown): Promise<ImportPhotoResult> {
  const { supabase, userId } = await requireUser();
  const parsed = z.string().max(500).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Foto no válida." };

  try {
    const photo = await downloadStockPhoto(parsed.data);
    const path = `${userId}/${crypto.randomUUID()}.${photo.ext}`;
    const { error } = await supabase.storage
      .from(RECIPE_IMAGES_BUCKET)
      .upload(path, photo.bytes, { contentType: photo.contentType });
    if (error) return { ok: false, error: "No se pudo guardar la foto." };
    return { ok: true, path };
  } catch (error) {
    console.error("[stock-photos] import failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo guardar la foto." };
  }
}
