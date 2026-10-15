import "server-only";
import type { ShopSection, Unit } from "@/lib/recipes/constants";
import { createClient } from "@/lib/supabase/server";

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: number | null;
  unit: Unit | null;
  shop_section: ShopSection;
  checked: boolean;
  is_manual: boolean;
};

export type ShoppingList = {
  /** Null until a list is generated or a manual item is added. */
  range: { start: string; end: string } | null;
  items: ShoppingItem[];
  /** Generated items the user removed ("I already have it"), kept hidden. */
  removed: ShoppingItem[];
  /** Meals with a recipe inside the saved range. */
  plannedMeals: number;
};

/** The user's single active list. */
export async function getShoppingList(): Promise<ShoppingList> {
  const supabase = await createClient();
  const { data: list, error } = await supabase
    .from("shopping_lists")
    .select("id, start_date, end_date")
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar la lista de la compra.");
  if (!list) return { range: null, items: [], removed: [], plannedMeals: 0 };

  const [items, planned] = await Promise.all([
    supabase
      .from("shopping_items")
      .select("id, name, quantity, unit, shop_section, checked, is_manual, excluded")
      .eq("list_id", list.id),
    supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .gte("date", list.start_date)
      .lte("date", list.end_date)
      .not("recipe_id", "is", null),
  ]);
  if (items.error || planned.error) throw new Error("No se pudo cargar la lista de la compra.");

  const rows = items.data.map(({ excluded, ...row }) => ({
    item: { ...row, quantity: row.quantity === null ? null : Number(row.quantity) } as ShoppingItem,
    excluded: Boolean(excluded),
  }));
  return {
    range: { start: list.start_date, end: list.end_date },
    items: rows.filter((row) => !row.excluded).map((row) => row.item),
    removed: rows.filter((row) => row.excluded).map((row) => row.item),
    plannedMeals: planned.count ?? 0,
  };
}
