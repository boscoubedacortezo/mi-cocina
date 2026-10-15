"use server";

import { z } from "zod";
import { adaptRecipe } from "@/lib/ai/adapt-recipe";
import { ImportError } from "@/lib/ai/errors";
import { requireUser } from "@/lib/auth-server";
import { getRecipe } from "@/lib/recipes/queries";

export type AdaptResult =
  | {
      ok: true;
      steps: string[];
      tips: string[];
      prep_minutes: number | null;
      cook_minutes: number | null;
    }
  | { ok: false; error: string };

const inputSchema = z.object({
  recipeId: z.uuid(),
  servings: z.number().int().min(1).max(100),
});

/** Suggests the steps and times for another number of servings. Nothing is saved. */
export async function adaptRecipeToServings(input: unknown): Promise<AdaptResult> {
  await requireUser();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Raciones no válidas." };

  const recipe = await getRecipe(parsed.data.recipeId);
  if (recipe.steps.length === 0) return { ok: false, error: "La receta no tiene pasos que adaptar." };
  if (parsed.data.servings === recipe.servings) {
    return { ok: false, error: "Cambia primero las raciones." };
  }

  try {
    return { ok: true, ...(await adaptRecipe(recipe, parsed.data.servings)) };
  } catch (error) {
    if (error instanceof ImportError) return { ok: false, error: error.message };
    console.error("[adapt] unexpected error:", error);
    return { ok: false, error: "No se pudo adaptar la receta. Inténtalo de nuevo." };
  }
}
