"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth-server";
import { addDays, todayInMadrid } from "@/lib/menu/dates";
import { aggregateIngredients, lineKey, type SourceIngredient } from "@/lib/shopping/aggregate";
import { DEFAULT_RANGE_DAYS, manualItemSchema, rangeSchema } from "@/lib/shopping/schema";

export type ShoppingResult = { ok: true; message: string | null } | { ok: false; error: string };

const GENERIC_ERROR = "No se pudo actualizar la lista. Inténtalo de nuevo.";
const fail = (error: string): ShoppingResult => ({ ok: false, error });
const done = (message: string | null = null): ShoppingResult => ({ ok: true, message });

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** The user's one list, created with the default range if it does not exist yet. */
async function ensureList(supabase: Supabase, range?: { start: string; end: string }) {
  const { data: existing } = await supabase.from("shopping_lists").select("id").maybeSingle();
  if (existing) {
    if (range) {
      const { error } = await supabase
        .from("shopping_lists")
        .update({ start_date: range.start, end_date: range.end })
        .eq("id", existing.id);
      if (error) return null;
    }
    return existing.id as string;
  }
  const start = range?.start ?? todayInMadrid();
  const { data, error } = await supabase
    .from("shopping_lists")
    .insert({ start_date: start, end_date: range?.end ?? addDays(start, DEFAULT_RANGE_DAYS - 1) })
    .select("id")
    .single();
  return error ? null : (data.id as string);
}

/**
 * Rebuilds the generated part of the list from the meals in a date range. Manual
 * items stay; generated ones keep their state (ticked, or removed because the user
 * already has them) when the same product is still needed.
 */
export async function generateShoppingList(input: unknown): Promise<ShoppingResult> {
  const { supabase } = await requireUser();
  const range = rangeSchema.safeParse(input);
  if (!range.success) return fail(range.error.issues[0].message);

  const { data: planned, error: plannedError } = await supabase
    .from("menu_items")
    .select("recipe_id, servings")
    .gte("date", range.data.start)
    .lte("date", range.data.end)
    .not("recipe_id", "is", null);
  if (plannedError) return fail(GENERIC_ERROR);
  if (!planned.length) return fail("No hay recetas en el menú entre esas fechas.");

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
  if (!lines.length) return fail("Las recetas de ese periodo no tienen ingredientes.");

  const listId = await ensureList(supabase, range.data);
  if (!listId) return fail(GENERIC_ERROR);

  const { data: existing, error: existingError } = await supabase
    .from("shopping_items")
    .select("id, name, unit, checked, excluded, is_manual")
    .eq("list_id", listId);
  if (existingError) return fail(GENERIC_ERROR);

  const generated = existing.filter((item) => !item.is_manual);
  const previous = new Map(
    generated.map((item) => [lineKey(item.name, item.unit), { checked: item.checked, excluded: item.excluded }]),
  );

  // New rows go in first so a failure never leaves the list empty.
  const { error } = await supabase.from("shopping_items").insert(
    lines.map((line) => ({
      list_id: listId,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      shop_section: line.shop_section,
      checked: previous.get(line.key)?.checked ?? false,
      excluded: previous.get(line.key)?.excluded ?? false,
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
  const hidden = lines.filter((line) => previous.get(line.key)?.excluded).length;
  return done(
    `${lines.length - hidden} artículos en la lista` + (hidden ? ` (${hidden} quitados porque ya los tenías).` : "."),
  );
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

  const listId = await ensureList(supabase);
  if (!listId) return fail(GENERIC_ERROR);

  const { error } = await supabase
    .from("shopping_items")
    .insert({ ...parsed.data, list_id: listId, checked: false, is_manual: true });
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/compra");
  return done();
}

/**
 * "Remove" an item. One you added by hand is deleted; a generated one is only
 * hidden, so regenerating the list does not bring it back.
 */
export async function removeShoppingItem(id: unknown): Promise<ShoppingResult> {
  const { supabase } = await requireUser();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return fail("Artículo no válido.");

  const { data: item, error: readError } = await supabase
    .from("shopping_items")
    .select("is_manual")
    .eq("id", parsed.data)
    .maybeSingle();
  if (readError) return fail(GENERIC_ERROR);
  if (!item) return done();

  const { error } = item.is_manual
    ? await supabase.from("shopping_items").delete().eq("id", parsed.data)
    : await supabase.from("shopping_items").update({ excluded: true }).eq("id", parsed.data);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/compra");
  return done();
}

/** Puts back an item that was removed. */
export async function restoreShoppingItem(id: unknown): Promise<ShoppingResult> {
  const { supabase } = await requireUser();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return fail("Artículo no válido.");

  const { error } = await supabase
    .from("shopping_items")
    .update({ excluded: false, checked: false })
    .eq("id", parsed.data);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/compra");
  return done();
}
