"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-server";
import { RECIPE_IMAGES_BUCKET } from "@/lib/recipes/constants";
import { recipeInputSchema } from "@/lib/recipes/schema";

export type ActionResult = { error: string };

const GENERIC_ERROR = "No se pudo guardar la receta. Inténtalo de nuevo.";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

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
    .select("image_path")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { error: "La receta ya no existe." };

  const [oldIngredients, oldSteps] = await Promise.all([
    supabase.from("recipe_ingredients").select("id").eq("recipe_id", id),
    supabase.from("recipe_steps").select("id").eq("recipe_id", id),
  ]);
  if (oldIngredients.error || oldSteps.error) return { error: GENERIC_ERROR };

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
