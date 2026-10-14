"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth-server";
import { ensureMenu } from "@/lib/menu/ensure";
import { weekStartSchema } from "@/lib/menu/schema";
import { aggregateIngredients, lineKey, type SourceIngredient } from "@/lib/shopping/aggregate";
import { manualItemSchema } from "@/lib/shopping/schema";

export type ShoppingResult = { ok: true; message: string | null } | { ok: false; error: string };

const GENERIC_ERROR = "No se pudo actualizar la lista. Inténtalo de nuevo.";
const fail = (error: string): ShoppingResult => ({ ok: false, error });
const done = (message: string | null = null): ShoppingResult => ({ ok: true, message });

/**
 * Rebuilds the generated part of the week's list from its menu. Manual items
 * stay, and generated items already ticked stay ticked.
 */
export async function generateShoppingList(input: unknown): Promise<ShoppingResult> {
  const { supabase } = await requireUser();
  const week = weekStartSchema.safeParse(input);
  if (!week.success) return fail(week.error.issues[0].message);

  const { data: menu } = await supabase
    .from("menus")
    .select("id")
    .eq("week_start", week.data)
    .maybeSingle();
  if (!menu) return fail("Todavía no has planificado esta semana.");

  const { data: planned, error: plannedError } = await supabase
    .from("menu_items")
    .select("recipe_id, servings")
    .eq("menu_id", menu.id)
    .not("recipe_id", "is", null);
  if (plannedError) return fail(GENERIC_ERROR);
  if (!planned.length) return fail("El menú de esta semana no tiene recetas.");

  const recipeIds = [...new Set(planned.map((row) => row.recipe_id as string))];
  const [recipes, ingredients] = await Promise.all([
    supabase.from("recipes").select("id, servings").in("id", recipeIds),
    supabase
      .from("recipe_ingredients")
      .select("recipe_id, name, quantity, unit, shop_section")
      .in("recipe_id", recipeIds),
  ]);
  if (recipes.error || ingredients.error) return fail(GENERIC_ERROR);

  const servingsByRecipe = new Map(recipes.data.map((r) => [r.id as string, r.servings as number]));
  const byRecipe = new Map<string, SourceIngredient[]>();
  for (const row of ingredients.data) {
    const list = byRecipe.get(row.recipe_id) ?? [];
    list.push({
      name: row.name,
      quantity: row.quantity === null ? null : Number(row.quantity),
      unit: row.unit,
      shop_section: row.shop_section,
    });
    byRecipe.set(row.recipe_id, list);
  }

  // A recipe planned for 8 servings that is written for 4 counts double.
  const lines = aggregateIngredients(
    planned.flatMap((row) => {
      const base = servingsByRecipe.get(row.recipe_id as string);
      if (!base) return [];
      return [{ factor: row.servings / base, ingredients: byRecipe.get(row.recipe_id as string) ?? [] }];
    }),
  );
  if (!lines.length) return fail("Las recetas del menú no tienen ingredientes.");

  const { data: existing, error: existingError } = await supabase
    .from("shopping_items")
    .select("id, name, unit, checked, is_manual")
    .eq("menu_id", menu.id);
  if (existingError) return fail(GENERIC_ERROR);

  const generated = existing.filter((item) => !item.is_manual);
  const ticked = new Set(
    generated.filter((item) => item.checked).map((item) => lineKey(item.name, item.unit)),
  );

  // New rows go in first so a failure never leaves the list empty.
  const { error } = await supabase.from("shopping_items").insert(
    lines.map((line) => ({
      menu_id: menu.id,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      shop_section: line.shop_section,
      checked: ticked.has(line.key),
      is_manual: false,
    })),
  );
  if (error) return fail(GENERIC_ERROR);

  if (generated.length) {
    await supabase
      .from("shopping_items")
      .delete()
      .in("id", generated.map((item) => item.id));
  }

  revalidatePath("/compra");
  return done(`${lines.length} artículos en la lista.`);
}

export async function toggleShoppingItem(id: unknown, checked: unknown): Promise<ShoppingResult> {
  const { supabase } = await requireUser();
  const parsed = z.object({ id: z.uuid(), checked: z.boolean() }).safeParse({ id, checked });
  if (!parsed.success) return fail("Artículo no válido.");

  const { error } = await supabase
    .from("shopping_items")
    .update({ checked: parsed.data.checked })
    .eq("id", parsed.data.id);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/compra");
  return done();
}

export async function addShoppingItem(input: unknown): Promise<ShoppingResult> {
  const { supabase } = await requireUser();
  const parsed = manualItemSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { weekStart, ...item } = parsed.data;

  const menuId = await ensureMenu(supabase, weekStart);
  if (!menuId) return fail(GENERIC_ERROR);

  const { error } = await supabase
    .from("shopping_items")
    .insert({ ...item, menu_id: menuId, checked: false, is_manual: true });
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/compra");
  return done();
}

export async function deleteShoppingItem(id: unknown): Promise<ShoppingResult> {
  const { supabase } = await requireUser();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return fail("Artículo no válido.");

  const { error } = await supabase.from("shopping_items").delete().eq("id", parsed.data);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/compra");
  return done();
}
