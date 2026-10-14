import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Meal } from "./schema";

export type MenuItemView = {
  id: string;
  date: string;
  meal: Meal;
  servings: number;
  recipe: { id: string; title: string; tags: string[] } | null;
};

export type RecipeOption = {
  id: string;
  title: string;
  tags: string[];
  minutes: number | null;
};

export async function getWeekItems(weekStart: string): Promise<MenuItemView[]> {
  const supabase = await createClient();
  const { data: menu, error } = await supabase
    .from("menus")
    .select("id")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el menú.");
  if (!menu) return [];

  const { data, error: itemsError } = await supabase
    .from("menu_items")
    .select("id, date, meal, servings, recipes(id, title, tags)")
    .eq("menu_id", menu.id)
    .order("date");
  if (itemsError) throw new Error("No se pudo cargar el menú.");

  return data.map(
    (row): MenuItemView => ({
      id: row.id,
      date: row.date,
      meal: row.meal,
      servings: row.servings,
      // A to-one join comes back as an object (typed as a list without a schema).
      recipe: (Array.isArray(row.recipes) ? row.recipes[0] : row.recipes) ?? null,
    }),
  );
}

export async function listRecipeOptions(): Promise<RecipeOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, tags, prep_minutes, cook_minutes")
    .order("title");
  if (error) throw new Error("No se pudieron cargar las recetas.");
  return data.map((recipe) => {
    const minutes = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
    return {
      id: recipe.id,
      title: recipe.title,
      tags: recipe.tags,
      minutes: minutes || null,
    };
  });
}

/** Recipes with their ingredient names, as context for the menu planner. */
export async function listRecipesForPlanning() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, tags, prep_minutes, cook_minutes, recipe_ingredients(name, position)")
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron cargar las recetas.");
  return data.map((recipe) => ({
    id: recipe.id as string,
    title: recipe.title as string,
    tags: recipe.tags as string[],
    minutes: ((recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0)) || null,
    ingredients: (recipe.recipe_ingredients as { name: string; position: number }[])
      .sort((a, b) => a.position - b.position)
      .map((item) => item.name),
  }));
}
