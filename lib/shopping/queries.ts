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
  const { data: menu, error } = await supabase
    .from("menus")
    .select("id")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar la lista de la compra.");
  if (!menu) return { items: [] as ShoppingItem[], plannedMeals: 0 };

  const [items, planned] = await Promise.all([
    supabase
      .from("shopping_items")
      .select("id, name, quantity, unit, shop_section, checked, is_manual")
      .eq("menu_id", menu.id),
    supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("menu_id", menu.id)
      .not("recipe_id", "is", null),
  ]);
  if (items.error) throw new Error("No se pudo cargar la lista de la compra.");

  return {
    items: items.data.map(
      (row): ShoppingItem => ({
        ...row,
        quantity: row.quantity === null ? null : Number(row.quantity),
      }),
    ),
    plannedMeals: planned.count ?? 0,
  };
}
