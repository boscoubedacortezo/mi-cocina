"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth-server";
import { ensureMenu } from "@/lib/menu/ensure";
import { slotSchema } from "@/lib/menu/schema";
import { resolveShopSections } from "@/lib/recipes/resolve-sections";
import { getMenuPreferences } from "@/lib/settings/queries";
import { contentSignature } from "@/lib/recipes/auto-meta";
import { RECIPE_IMAGES_BUCKET } from "@/lib/recipes/constants";
import { isCookidooImageHost } from "@/lib/recipes/cookidoo-url";
import { isSocialImageHost } from "@/lib/recipes/social-url";
import { recipeInputSchema } from "@/lib/recipes/schema";
import {
  autoFillMeta,
  deleteByIds,
  insertChildren,
  insertRecipe,
  ownsImage,
  saveImageFromUrl,
} from "@/lib/recipes/save";

export type ActionResult = { error: string };

const GENERIC_ERROR = "No se pudo guardar la receta. Inténtalo de nuevo.";

export async function createRecipe(input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const parsed = recipeInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!ownsImage(parsed.data.image_path, userId)) return { error: GENERIC_ERROR };
  // The supermarket section is never asked: it comes from the ingredient's name.
  parsed.data.ingredients = await resolveShopSections(parsed.data.ingredients);

  // An imported recipe can bring its own photo (Cookidoo's): saved here, best effort,
  // so abandoning the review never leaves a stray file in Storage.
  let imagePath = parsed.data.image_path;
  const remote = z
    .url({ protocol: /^https$/ })
    .max(2000)
    .safeParse((input as { image_source_url?: unknown } | null)?.image_source_url);
  if (!imagePath && remote.success) {
    const saved = await saveImageFromUrl(
      supabase,
      userId,
      remote.data,
      (host) => isCookidooImageHost(host) || isSocialImageHost(host),
    );
    if ("path" in saved) imagePath = saved.path;
  }

  const id = await insertRecipe(supabase, { ...parsed.data, image_path: imagePath });
  if (!id) {
    if (imagePath && imagePath !== parsed.data.image_path) {
      await supabase.storage.from(RECIPE_IMAGES_BUCKET).remove([imagePath]);
    }
    return { error: GENERIC_ERROR };
  }

  const { ingredients, steps, ...recipe } = parsed.data;
  await autoFillMeta(supabase, id, recipe, ingredients, steps, "missing");

  // Created from a menu slot: it goes straight into it, and the user lands back on the menu.
  const slot = slotSchema.safeParse((input as { menu_slot?: unknown } | null)?.menu_slot);
  if (slot.success) {
    const menuId = await ensureMenu(supabase, slot.data.weekStart);
    if (menuId) {
      const { servings } = await getMenuPreferences();
      const { error: slotError } = await supabase.from("menu_items").upsert(
        {
          menu_id: menuId,
          date: slot.data.date,
          meal: slot.data.meal,
          recipe_id: id,
          servings,
          away: false,
          leftovers: false,
        },
        { onConflict: "menu_id,date,meal" },
      );
      if (!slotError) {
        revalidatePath("/recetas");
        revalidatePath("/menu");
        redirect(`/menu?semana=${slot.data.weekStart}`);
      }
    }
  }

  revalidatePath("/recetas");
  redirect(`/recetas/${id}`);
}

export async function updateRecipe(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const parsed = recipeInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  parsed.data.ingredients = await resolveShopSections(parsed.data.ingredients);
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
