"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { convertToThermomix } from "@/lib/ai/convert-thermomix";
import { ImportError } from "@/lib/ai/errors";
import { requireUser } from "@/lib/auth-server";
import { contentSignature } from "@/lib/recipes/auto-meta";
import { getRecipe } from "@/lib/recipes/queries";
import { buildCookidooText } from "@/lib/thermomix/cookidoo";
import { thermomixInputSchema } from "@/lib/thermomix/schema";

export type TmResult =
  | { ok: true; notes: string | null }
  | { ok: false; error: string };

const idSchema = z.uuid();
const servingsSchema = z
  .number("Indica las raciones.")
  .int("Las raciones deben ser un número entero.")
  .min(1, "Mínimo 1 ración.")
  .max(100, "Máximo 100 raciones.");

const GENERIC_ERROR = "No se pudo guardar la versión Thermomix. Inténtalo de nuevo.";

function refresh(recipeId: string) {
  revalidatePath(`/recetas/${recipeId}`);
  revalidatePath(`/recetas/${recipeId}/thermomix`);
}

/** Converts a recipe to TM7 and stores it, replacing any previous version. */
export async function convertToTm7(
  recipeId: unknown,
  servings: unknown,
): Promise<TmResult> {
  const { supabase } = await requireUser();
  const id = idSchema.safeParse(recipeId);
  const parsedServings = servingsSchema.safeParse(servings);
  if (!id.success) return { ok: false, error: "Receta no válida." };
  if (!parsedServings.success) {
    return { ok: false, error: parsedServings.error.issues[0].message };
  }

  const recipe = await getRecipe(id.data);
  if (recipe.ingredients.length === 0 && recipe.steps.length === 0) {
    return { ok: false, error: "La receta no tiene ingredientes ni pasos que convertir." };
  }

  let draft;
  try {
    draft = await convertToThermomix(recipe, parsedServings.data);
  } catch (error) {
    if (error instanceof ImportError) return { ok: false, error: error.message };
    console.error("[thermomix] unexpected error:", error);
    return { ok: false, error: "No se pudo convertir la receta. Inténtalo de nuevo." };
  }

  const { data: previous, error: previousError } = await supabase
    .from("thermomix_versions")
    .select("id")
    .eq("recipe_id", id.data);
  if (previousError) return { ok: false, error: GENERIC_ERROR };

  // The new version goes in first so a failure never leaves the recipe without one.
  const { error } = await supabase.from("thermomix_versions").insert({
    recipe_id: id.data,
    model: "TM7",
    servings: draft.servings,
    notes: draft.notes,
    source_signature: contentSignature(recipe),
    ingredients_text: draft.ingredients_text,
    steps: draft.steps,
    cookidoo_text: buildCookidooText(draft.ingredients_text, draft.steps),
  });
  if (error) return { ok: false, error: GENERIC_ERROR };

  if (previous.length) {
    await supabase
      .from("thermomix_versions")
      .delete()
      .in("id", previous.map((row) => row.id));
  }

  refresh(id.data);
  return { ok: true, notes: draft.notes };
}

/** Saves the user's edits and regenerates the Cookidoo text from them. */
export async function saveThermomixVersion(
  recipeId: unknown,
  versionId: unknown,
  input: unknown,
): Promise<TmResult> {
  const { supabase } = await requireUser();
  const rid = idSchema.safeParse(recipeId);
  const vid = idSchema.safeParse(versionId);
  if (!rid.success || !vid.success) return { ok: false, error: "Versión no válida." };

  const parsed = thermomixInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { servings, ingredients_text, steps } = parsed.data;

  const { data, error } = await supabase
    .from("thermomix_versions")
    .update({
      servings,
      ingredients_text,
      steps,
      cookidoo_text: buildCookidooText(ingredients_text, steps),
    })
    .eq("id", vid.data)
    .eq("recipe_id", rid.data)
    .select("id");
  if (error) return { ok: false, error: GENERIC_ERROR };
  if (!data.length) return { ok: false, error: "La versión ya no existe." };

  refresh(rid.data);
  return { ok: true, notes: null };
}
