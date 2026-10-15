"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { estimateRecipe } from "@/lib/ai/estimate-recipe";
import { requireUser } from "@/lib/auth-server";
import { contentSignature, planAutoMeta, type AutoMetaMode } from "@/lib/recipes/auto-meta";
import { formatIngredient } from "@/lib/recipes/format";
import { listAllTags } from "@/lib/recipes/queries";
import { RECIPE_IMAGES_BUCKET } from "@/lib/recipes/constants";
import { recipeInputSchema } from "@/lib/recipes/schema";

export type ActionResult = { error: string };

const GENERIC_ERROR = "No se pudo guardar la receta. Inténtalo de nuevo.";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

const AUTO_META_TIMEOUT_MS = 15_000;

/**
 * Writes times and tags from the recipe's content right after saving. Best effort:
 * any failure is logged and ignored, the recipe is already saved.
 */
async function autoFillMeta(
  supabase: Supabase,
  id: string,
  recipe: { title: string; servings: number; prep_minutes: number | null; cook_minutes: number | null; tags: string[] },
  ingredients: { name: string; quantity: number | null; unit: Parameters<typeof formatIngredient>[0]["unit"] }[],
  steps: { text: string }[],
  mode: AutoMetaMode,
) {
  const plan = planAutoMeta({ ...recipe, stepCount: steps.length }, mode);
  if (!plan.times && !plan.tags) return;

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
    } = {};
    if (plan.times) {
      // Recomputing replaces old values, so a part that no longer exists is cleared.
      if (mode === "all" || estimate.prep_minutes !== null) patch.prep_minutes = estimate.prep_minutes;
      if (mode === "all" || estimate.cook_minutes !== null) patch.cook_minutes = estimate.cook_minutes;
    }
    if (plan.tags && estimate.tags.length) patch.tags = estimate.tags;
    if (Object.keys(patch).length) {
      await supabase.from("recipes").update(patch).eq("id", id);
    }
  } catch (error) {
    console.error("[recipes] auto estimate skipped:", error instanceof Error ? error.message : error);
  }
}

export async function createRecipe(input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const parsed = recipeInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ingredients, steps, ...recipe } = parsed.data;
  if (!ownsImage(recipe.image_path, userId)) return { error: GENERIC_ERROR };

  const { data, error } = await supabase
    .from("recipes")
    .insert(recipe)
    .select("id")
    .single();
  if (error) return { error: GENERIC_ERROR };

  const children = await insertChildren(supabase, data.id, ingredients, steps);
  if (!children) {
    // Children cascade-delete with the recipe.
    await supabase.from("recipes").delete().eq("id", data.id);
    return { error: GENERIC_ERROR };
  }

  await autoFillMeta(supabase, data.id, recipe, ingredients, steps, "missing");

  revalidatePath("/recetas");
  redirect(`/recetas/${data.id}`);
}

export async function updateRecipe(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const parsed = recipeInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ingredients, steps, ...recipe } = parsed.data;
  if (!ownsImage(recipe.image_path, userId)) return { error: GENERIC_ERROR };

  const { data: existing } = await supabase
    .from("recipes")
    .select("image_path, title")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { error: "La receta ya no existe." };

  const [oldIngredients, oldSteps] = await Promise.all([
    supabase
      .from("recipe_ingredients")
      .select("id, name, quantity, unit")
      .eq("recipe_id", id)
      .order("position"),
    supabase.from("recipe_steps").select("id, text").eq("recipe_id", id).order("position"),
  ]);
  if (oldIngredients.error || oldSteps.error) return { error: GENERIC_ERROR };

  // Times and tags come from the content: recompute them only if it changed.
  const contentChanged =
    contentSignature({
      title: existing.title,
      ingredients: oldIngredients.data,
      steps: oldSteps.data,
    }) !== contentSignature({ title: recipe.title, ingredients, steps });

  // New rows go in first and old ones are removed afterwards, so a failure
  // midway never leaves the recipe without ingredients or steps.
  const children = await insertChildren(supabase, id, ingredients, steps);
  if (!children) return { error: GENERIC_ERROR };

  const { error } = await supabase.from("recipes").update(recipe).eq("id", id);
  if (error) {
    await Promise.all([
      deleteByIds(supabase, "recipe_ingredients", children.ingredientIds),
      deleteByIds(supabase, "recipe_steps", children.stepIds),
    ]);
    return { error: GENERIC_ERROR };
  }

  await Promise.all([
    deleteByIds(supabase, "recipe_ingredients", oldIngredients.data.map((r) => r.id)),
    deleteByIds(supabase, "recipe_steps", oldSteps.data.map((r) => r.id)),
  ]);
  if (existing.image_path && existing.image_path !== recipe.image_path) {
    await supabase.storage.from(RECIPE_IMAGES_BUCKET).remove([existing.image_path]);
  }

  await autoFillMeta(supabase, id, recipe, ingredients, steps, contentChanged ? "all" : "missing");

  revalidatePath("/recetas");
  revalidatePath(`/recetas/${id}`);
  redirect(`/recetas/${id}`);
}

export async function deleteRecipe(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const { data: existing } = await supabase
    .from("recipes")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) return { error: "No se pudo borrar la receta." };

  if (existing?.image_path) {
    await supabase.storage.from(RECIPE_IMAGES_BUCKET).remove([existing.image_path]);
  }

  revalidatePath("/recetas");
  redirect("/recetas");
}

function ownsImage(path: string | null, userId: string) {
  return path === null || (path.startsWith(`${userId}/`) && !path.includes(".."));
}

async function insertChildren(
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

async function deleteByIds(
  supabase: Supabase,
  table: "recipe_ingredients" | "recipe_steps",
  ids: string[],
) {
  if (ids.length) await supabase.from(table).delete().in("id", ids);
}
