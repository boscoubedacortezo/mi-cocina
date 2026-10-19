import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Course, MainIngredient } from "@/lib/recipes/constants";
import type { Meal } from "./schema";

export type MenuItemView = {
  id: string;
  date: string;
  meal: Meal;
  servings: number;
  /** Marked "fuera de casa": no recipe, and the AI skips it. */
  away: boolean;
  recipe: { id: string; title: string; tags: string[] } | null;
};

export type RecipeOption = {
  id: string;
  title: string;
  tags: string[];
  course: Course | null;
  main_ingredient: MainIngredient | null;
  minutes: number | null;
  /** For searching. */
  ingredients: string[];
  /** Times it has been planned in any week, and the last date: for "habituales" and "recientes". */
  uses: number;
  lastUsed: string | null;
};

export async function getWeekItems(weekStart: string): Promise<MenuItemView[]> {
  const supabase = await createClient();
  // One round trip: "!inner" filters the items by their menu's week.
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, date, meal, servings, away, recipes(id, title, tags), menus!inner(week_start)")
    .eq("menus.week_start", weekStart)
    .order("date");
  if (error) throw new Error("No se pudo cargar el menú.");

  return data.map(
    (row): MenuItemView => ({
      id: row.id,
      date: row.date,
      meal: row.meal,
      servings: row.servings,
      away: row.away,
      // A to-one join comes back as an object (typed as a list without a schema).
      recipe: (Array.isArray(row.recipes) ? row.recipes[0] : row.recipes) ?? null,
    }),
  );
}

export async function listRecipeOptions(): Promise<RecipeOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, tags, course, main_ingredient, prep_minutes, cook_minutes, recipe_ingredients(name)")
    .order("title");
  if (error) throw new Error("No se pudieron cargar las recetas.");

  const history = await supabase.from("menu_items").select("recipe_id, date").not("recipe_id", "is", null);
  const usage = new Map<string, { uses: number; lastUsed: string }>();
  for (const row of (history.data ?? []) as { recipe_id: string; date: string }[]) {
    const current = usage.get(row.recipe_id);
    usage.set(row.recipe_id, {
      uses: (current?.uses ?? 0) + 1,
      lastUsed: current && current.lastUsed > row.date ? current.lastUsed : row.date,
    });
  }

  return data.map((recipe) => {
    const minutes = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
    return {
      id: recipe.id,
      title: recipe.title,
      tags: recipe.tags,
      course: recipe.course,
      main_ingredient: recipe.main_ingredient,
      minutes: minutes || null,
      ingredients: ((recipe.recipe_ingredients ?? []) as { name: string }[]).map((i) => i.name),
      uses: usage.get(recipe.id)?.uses ?? 0,
      lastUsed: usage.get(recipe.id)?.lastUsed ?? null,
    };
  });
}

/** Recipes with their ingredient names, as context for the menu planner. */
export async function listRecipesForPlanning() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, title, tags, course, main_ingredient, prep_minutes, cook_minutes, recipe_ingredients(name, position)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron cargar las recetas.");
  return data.map((recipe) => ({
    id: recipe.id as string,
    title: recipe.title as string,
    tags: recipe.tags as string[],
    course: recipe.course as Course | null,
    main: recipe.main_ingredient as MainIngredient | null,
    minutes: ((recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0)) || null,
    ingredients: (recipe.recipe_ingredients as { name: string; position: number }[])
      .sort((a, b) => a.position - b.position)
      .map((item) => item.name),
  }));
}
