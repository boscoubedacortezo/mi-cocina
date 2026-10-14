import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { thermomixStepSchema } from "@/lib/thermomix/schema";
import type { SharedRecipe } from "./recipe-jsonld";

/** Loads the TM7 version of a recipe for the public share page. */
export async function getSharedRecipe(recipeId: string): Promise<SharedRecipe | null> {
  const supabase = createAdminClient();
  const [recipe, version] = await Promise.all([
    supabase
      .from("recipes")
      .select("title, description, servings, prep_minutes, cook_minutes, tags")
      .eq("id", recipeId)
      .maybeSingle(),
    supabase
      .from("thermomix_versions")
      .select("servings, ingredients_text, steps")
      .eq("recipe_id", recipeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!recipe.data || !version.data) return null;

  const steps = z.array(thermomixStepSchema).safeParse(version.data.steps);
  if (!steps.success) return null;

  return {
    title: recipe.data.title,
    description: recipe.data.description,
    servings: version.data.servings ?? recipe.data.servings,
    prepMinutes: recipe.data.prep_minutes,
    cookMinutes: recipe.data.cook_minutes,
    tags: recipe.data.tags,
    ingredients: version.data.ingredients_text
      .split("\n")
      .map((line: string) => line.trim())
      .filter(Boolean),
    steps: steps.data,
  };
}
