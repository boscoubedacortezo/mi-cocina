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

export async function getShoppingList(weekStart: string) {
  const supabase = await createClient();
  // Both queries run together; "!inner" filters by the menu's week without a lookup first.
  const [items, planned] = await Promise.all([
    supabase
      .from("shopping_items")
      .select("id, name, quantity, unit, shop_section, checked, is_manual, menus!inner(week_start)")
      .eq("menus.week_start", weekStart),
    supabase
      .from("menu_items")
      .select("id, menus!inner(week_start)", { count: "exact", head: true })
      .eq("menus.week_start", weekStart)
      .not("recipe_id", "is", null),
  ]);
  if (items.error || planned.error) throw new Error("No se pudo cargar la lista de la compra.");

  return {
    items: items.data.map(
      ({ menus, ...row }): ShoppingItem => {
        void menus; // only used to filter
        return { ...row, quantity: row.quantity === null ? null : Number(row.quantity) };
      },
    ),
    plannedMeals: planned.count ?? 0,
  };
}
