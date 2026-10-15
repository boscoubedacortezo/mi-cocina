import "server-only";
import { estimateRecipe } from "@/lib/ai/estimate-recipe";
import { fetchPublicImage } from "@/lib/ai/safe-fetch";
import type { requireUser } from "@/lib/auth-server";
import { planAutoMeta, type AutoMetaMode } from "@/lib/recipes/auto-meta";
import { formatIngredient } from "@/lib/recipes/format";
import { listAllTags } from "@/lib/recipes/queries";
import { RECIPE_IMAGES_BUCKET, type Course, type MainIngredient } from "@/lib/recipes/constants";
import type { RecipeInput } from "@/lib/recipes/schema";

// Shared by the recipe form actions and by the "add from Cookidoo" shortcut,
// so a recipe is saved the same way wherever it comes from.
// (Not a "use server" file on purpose: nothing here may be callable from the browser.)

export type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

const AUTO_META_TIMEOUT_MS = 15_000;

/**
 * Writes times and tags from the recipe's content right after saving. Best effort:
 * any failure is logged and ignored, the recipe is already saved.
 */
export async function autoFillMeta(
  supabase: Supabase,
  id: string,
  recipe: {
    title: string;
    servings: number;
    prep_minutes: number | null;
    cook_minutes: number | null;
    tags: string[];
    course: Course | null;
    main_ingredient: MainIngredient | null;
  },
  ingredients: { name: string; quantity: number | null; unit: Parameters<typeof formatIngredient>[0]["unit"] }[],
  steps: { text: string }[],
  mode: AutoMetaMode,
) {
  const plan = planAutoMeta(
    { ...recipe, stepCount: steps.length, ingredientCount: ingredients.length },
    mode,
  );
  if (!plan.times && !plan.tags && !plan.categories) return;

  try {
    const estimate = await estimateRecipe(
      {
        title: recipe.title,
        servings: recipe.servings,
        ingredients: ingredients.map(formatIngredient),
        steps: steps.map((step) => step.text),
      },
      await listAllTags(),
      { timeoutMs: AUTO_META_TIMEOUT_MS },
    );

    const patch: {
      prep_minutes?: number | null;
      cook_minutes?: number | null;
      tags?: string[];
      course?: Course;
      main_ingredient?: MainIngredient;
    } = {};
    if (plan.times) {
      // Recomputing replaces old values, so a part that no longer exists is cleared.
      if (mode === "all" || estimate.prep_minutes !== null) patch.prep_minutes = estimate.prep_minutes;
      if (mode === "all" || estimate.cook_minutes !== null) patch.cook_minutes = estimate.cook_minutes;
    }
    if (plan.tags && estimate.tags.length) patch.tags = estimate.tags;
    if (plan.categories) {
      // Only the absent one is filled: what the user chose is never overwritten.
      if (recipe.course === null) patch.course = estimate.course;
      if (recipe.main_ingredient === null) patch.main_ingredient = estimate.main_ingredient;
    }
    if (Object.keys(patch).length) {
      await supabase.from("recipes").update(patch).eq("id", id);
    }
  } catch (error) {
    console.error("[recipes] auto estimate skipped:", error instanceof Error ? error.message : error);
  }
}


/** Inserts a recipe with its ingredients and steps. Returns its id, or null if it could not be saved. */
export async function insertRecipe(
  supabase: Supabase,
  input: RecipeInput,
): Promise<string | null> {
  const { ingredients, steps, ...recipe } = input;
  const { data, error } = await supabase.from("recipes").insert(recipe).select("id").single();
  if (error) return null;

  const children = await insertChildren(supabase, data.id, ingredients, steps);
  if (!children) {
    // Children cascade-delete with the recipe.
    await supabase.from("recipes").delete().eq("id", data.id);
    return null;
  }
  return data.id;
}

export function ownsImage(path: string | null, userId: string) {
  return path === null || (path.startsWith(`${userId}/`) && !path.includes(".."));
}

export async function insertChildren(
  supabase: Supabase,
  recipeId: string,
  ingredients: { name: string; quantity: number | null; unit: string | null; shop_section: string; optional: boolean }[],
  steps: { text: string }[],
) {
  const [ing, stp] = await Promise.all([
    ingredients.length
      ? supabase
          .from("recipe_ingredients")
          .insert(
            ingredients.map((item, position) => ({
              ...item,
              recipe_id: recipeId,
              position,
            })),
          )
          .select("id")
      : { data: [], error: null },
    steps.length
      ? supabase
          .from("recipe_steps")
          .insert(
            steps.map((step, position) => ({
              ...step,
              recipe_id: recipeId,
              position,
            })),
          )
          .select("id")
      : { data: [], error: null },
  ]);

  const ingredientIds = (ing.data ?? []).map((r: { id: string }) => r.id);
  const stepIds = (stp.data ?? []).map((r: { id: string }) => r.id);
  if (ing.error || stp.error) {
    await Promise.all([
      deleteByIds(supabase, "recipe_ingredients", ingredientIds),
      deleteByIds(supabase, "recipe_steps", stepIds),
    ]);
    return null;
  }
  return { ingredientIds, stepIds };
}

export async function deleteByIds(
  supabase: Supabase,
  table: "recipe_ingredients" | "recipe_steps",
  ids: string[],
) {
  if (ids.length) await supabase.from(table).delete().in("id", ids);
}

/**
 * Copies a remote photo into the user's private storage and returns its path.
 * Best effort: a recipe is worth saving without its photo, so failures give null.
 */
export async function saveImageFromUrl(
  supabase: Supabase,
  userId: string,
  imageUrl: string,
  allowHost: (hostname: string) => boolean,
): Promise<string | null> {
  try {
    const image = await fetchPublicImage(imageUrl, allowHost);
    const path = `${userId}/${crypto.randomUUID()}.${image.ext}`;
    const { error } = await supabase.storage
      .from(RECIPE_IMAGES_BUCKET)
      .upload(path, image.bytes, { contentType: image.contentType });
    return error ? null : path;
  } catch (error) {
    console.error("[recipes] photo skipped:", error instanceof Error ? error.message : error);
    return null;
  }
}
