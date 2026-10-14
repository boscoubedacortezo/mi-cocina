"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ImportError } from "@/lib/ai/errors";
import { planMenu } from "@/lib/ai/plan-menu";
import { requireUser } from "@/lib/auth-server";
import { weekDates } from "@/lib/menu/dates";
import { listRecipesForPlanning } from "@/lib/menu/queries";
import {
  DEFAULT_SERVINGS,
  MEALS,
  setSlotSchema,
  slotKey,
  slotSchema,
  weekStartSchema,
} from "@/lib/menu/schema";

export type MenuResult = { ok: true; message: string | null } | { ok: false; error: string };

const GENERIC_ERROR = "No se pudo actualizar el menú. Inténtalo de nuevo.";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

const fail = (error: string): MenuResult => ({ ok: false, error });
const done = (message: string | null = null): MenuResult => ({ ok: true, message });

/** Finds the week's menu, creating it on first use. */
async function ensureMenu(supabase: Supabase, weekStart: string) {
  const find = () =>
    supabase.from("menus").select("id").eq("week_start", weekStart).maybeSingle();

  const existing = await find();
  if (existing.error) return null;
  if (existing.data) return existing.data.id as string;

  const created = await supabase.from("menus").insert({ week_start: weekStart }).select("id").single();
  if (!created.error) return created.data.id as string;
  // Lost a race with another request creating the same week.
  const retry = await find();
  return (retry.data?.id as string | undefined) ?? null;
}

export async function setSlot(input: unknown): Promise<MenuResult> {
  const { supabase } = await requireUser();
  const parsed = setSlotSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { slot, recipeId, servings } = parsed.data;

  const menuId = await ensureMenu(supabase, slot.weekStart);
  if (!menuId) return fail(GENERIC_ERROR);

  // RLS rejects recipes that are not the user's.
  const { error } = await supabase
    .from("menu_items")
    .upsert(
      { menu_id: menuId, date: slot.date, meal: slot.meal, recipe_id: recipeId, servings },
      { onConflict: "menu_id,date,meal" },
    );
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/menu");
  return done();
}

export async function clearSlot(input: unknown): Promise<MenuResult> {
  const { supabase } = await requireUser();
  const parsed = slotSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { weekStart, date, meal } = parsed.data;

  const { data: menu } = await supabase
    .from("menus")
    .select("id")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (menu) {
    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("menu_id", menu.id)
      .eq("date", date)
      .eq("meal", meal);
    if (error) return fail(GENERIC_ERROR);
  }

  revalidatePath("/menu");
  return done();
}

export async function setSlotServings(input: unknown): Promise<MenuResult> {
  const { supabase } = await requireUser();
  const parsed = z
    .object({ slot: slotSchema, servings: setSlotSchema.shape.servings })
    .safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { slot, servings } = parsed.data;

  const { data: menu } = await supabase
    .from("menus")
    .select("id")
    .eq("week_start", slot.weekStart)
    .maybeSingle();
  if (!menu) return fail("Ese hueco ya no existe.");

  const { error } = await supabase
    .from("menu_items")
    .update({ servings })
    .eq("menu_id", menu.id)
    .eq("date", slot.date)
    .eq("meal", slot.meal);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/menu");
  return done();
}

export async function clearWeek(input: unknown): Promise<MenuResult> {
  const { supabase } = await requireUser();
  const parsed = weekStartSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const { data: menu } = await supabase
    .from("menus")
    .select("id")
    .eq("week_start", parsed.data)
    .maybeSingle();
  if (menu) {
    const { error } = await supabase.from("menu_items").delete().eq("menu_id", menu.id);
    if (error) return fail(GENERIC_ERROR);
  }

  revalidatePath("/menu");
  return done();
}

/** Slots currently filled in the week, by key, with their recipe. */
async function loadFixed(supabase: Supabase, menuId: string) {
  const { data, error } = await supabase
    .from("menu_items")
    .select("date, meal, recipe_id")
    .eq("menu_id", menuId);
  if (error) return null;
  return (data as { date: string; meal: (typeof MEALS)[number]; recipe_id: string | null }[])
    .filter((row) => row.recipe_id)
    .map((row) => ({ key: slotKey(row.date, row.meal), recipeId: row.recipe_id as string }));
}

async function runPlanner(
  supabase: Supabase,
  weekStart: string,
  target: { date: string; meal: (typeof MEALS)[number] } | null,
): Promise<MenuResult> {
  const menuId = await ensureMenu(supabase, weekStart);
  if (!menuId) return fail(GENERIC_ERROR);
  // A deleted recipe leaves its slot with no recipe: free it so it can be filled.
  await supabase.from("menu_items").delete().eq("menu_id", menuId).is("recipe_id", null);
  const fixedAll = await loadFixed(supabase, menuId);
  if (!fixedAll) return fail(GENERIC_ERROR);

  const allKeys = weekDates(weekStart).flatMap((date) => MEALS.map((meal) => slotKey(date, meal)));
  const targetKey = target ? slotKey(target.date, target.meal) : null;
  const filled = new Set(fixedAll.map((f) => f.key));

  // Whole week: fill what is empty. Single slot: replace it, never with its current recipe.
  const empty = targetKey ? [targetKey] : allKeys.filter((key) => !filled.has(key));
  if (empty.length === 0) return fail("No hay huecos vacíos. Vacía la semana o quita alguna receta.");
  const fixed = fixedAll.filter((f) => f.key !== targetKey);
  const exclude = targetKey
    ? fixedAll.filter((f) => f.key === targetKey).map((f) => f.recipeId)
    : [];

  const recipes = await listRecipesForPlanning();
  if (recipes.length === 0) return fail("Todavía no tienes recetas guardadas.");

  let plan;
  try {
    plan = await planMenu({ recipes, fixed, empty, exclude });
  } catch (error) {
    if (error instanceof ImportError) return fail(error.message);
    console.error("[menu] unexpected error:", error);
    return fail("No se pudo generar el menú. Inténtalo de nuevo.");
  }
  if (plan.assignments.size === 0) {
    return fail(plan.notes ?? "No hay recetas que encajen para esos huecos.");
  }

  const { data: existing } = await supabase
    .from("menu_items")
    .select("date, meal, servings")
    .eq("menu_id", menuId);
  const servingsBySlot = new Map(
    (existing ?? []).map((row: { date: string; meal: string; servings: number }) => [
      slotKey(row.date, row.meal as (typeof MEALS)[number]),
      row.servings,
    ]),
  );

  const rows = [...plan.assignments].map(([key, recipeId]) => {
    const [date, meal] = key.split("|");
    return {
      menu_id: menuId,
      date,
      meal,
      recipe_id: recipeId,
      servings: servingsBySlot.get(key) ?? DEFAULT_SERVINGS,
    };
  });
  // Whole week: never overwrite a slot the user filled meanwhile.
  const { error } = await supabase
    .from("menu_items")
    .upsert(rows, { onConflict: "menu_id,date,meal", ignoreDuplicates: !targetKey });
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/menu");
  const missing = empty.length - plan.assignments.size;
  const warning = missing > 0 ? ` ${missing} hueco(s) se han quedado vacíos.` : "";
  return done(`${plan.notes ?? ""}${warning}`.trim() || null);
}

/** Fills the week's empty slots with AI, keeping what the user already set. */
export async function generateWeek(input: unknown): Promise<MenuResult> {
  const { supabase } = await requireUser();
  const parsed = weekStartSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  return runPlanner(supabase, parsed.data, null);
}

/** Replaces one slot with a different recipe chosen by AI. */
export async function regenerateSlot(input: unknown): Promise<MenuResult> {
  const { supabase } = await requireUser();
  const parsed = slotSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { weekStart, date, meal } = parsed.data;
  return runPlanner(supabase, weekStart, { date, meal });
}
