import "server-only";
import type { requireUser } from "@/lib/auth-server";
import { aggregateIngredients, type ShoppingLine } from "./aggregate";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

type MenuRow = {
  servings: number;
  recipes:
    | { servings: number; recipe_ingredients: Ingredient[] }
    | { servings: number; recipe_ingredients: Ingredient[] }[]
    | null;
};
type Ingredient = {
  name: string;
  quantity: number | string | null;
  unit: ShoppingLine["unit"];
  shop_section: ShoppingLine["shop_section"];
};

/**
 * The shopping lines for the meals in a date range, from the menu as it is now.
 * One query: each menu slot comes with its recipe and the recipe's ingredients.
 */
export async function computeShoppingLines(supabase: Supabase, range: { start: string; end: string }) {
  const { data, error } = await supabase
    .from("menu_items")
    .select("servings, recipes!inner(servings, recipe_ingredients(name, quantity, unit, shop_section))")
    .gte("date", range.start)
    .lte("date", range.end);
  if (error) throw new Error("No se pudo calcular la lista de la compra.");

  const rows = data as unknown as MenuRow[];
  const lines = aggregateIngredients(
    rows.flatMap((row) => {
      const recipe = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
      if (!recipe?.servings) return [];
      // A recipe planned for 8 servings that is written for 4 counts double.
      return [
        {
          factor: row.servings / recipe.servings,
          ingredients: recipe.recipe_ingredients.map((item) => ({
            name: item.name,
            quantity: item.quantity === null ? null : Number(item.quantity),
            unit: item.unit,
            shop_section: item.shop_section,
          })),
        },
      ];
    }),
  );
  return { lines, plannedMeals: rows.length };
}
