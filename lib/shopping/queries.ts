import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computeShoppingLines } from "./compute";
import { applyMarks, type Mark, type ShoppingEntry } from "./marks";

export type { ShoppingEntry };

export type ShoppingListData = {
  range: { start: string; end: string };
  /** False until the user changes the period or marks something. */
  saved: boolean;
  items: ShoppingEntry[];
  /** Lines the user removed because they already have them. */
  removed: ShoppingEntry[];
  /** Meals with a recipe inside the range. */
  plannedMeals: number;
};

/**
 * The user's list: lines computed from the menu now, with the user's marks applied,
 * plus the items added by hand. Nothing generated is stored.
 */
export async function getShoppingList(defaultRange: { start: string; end: string }): Promise<ShoppingListData> {
  const supabase = await createClient();
  const { data: list, error } = await supabase
    .from("shopping_lists")
    .select("id, start_date, end_date")
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar la lista de la compra.");

  const range = list ? { start: list.start_date as string, end: list.end_date as string } : defaultRange;
  const [computed, stored] = await Promise.all([
    computeShoppingLines(supabase, range),
    list
      ? supabase
          .from("shopping_items")
          .select("id, key, name, quantity, unit, shop_section, checked, excluded, is_manual, marked_quantity")
          .eq("list_id", list.id)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (stored.error) throw new Error("No se pudo cargar la lista de la compra.");

  const rows = stored.data as {
    id: string;
    key: string | null;
    name: string;
    quantity: number | string | null;
    unit: ShoppingEntry["unit"];
    shop_section: ShoppingEntry["shop_section"];
    checked: boolean;
    excluded: boolean;
    is_manual: boolean;
    marked_quantity: number | string | null;
  }[];

  const marks: Mark[] = rows
    .filter((row) => !row.is_manual && row.key)
    .map((row) => ({
      key: row.key as string,
      checked: row.checked,
      excluded: row.excluded,
      marked_quantity: row.marked_quantity === null ? null : Number(row.marked_quantity),
      unit: row.unit,
    }));
  const manual: ShoppingEntry[] = rows
    .filter((row) => row.is_manual)
    .map((row) => ({
      id: row.id,
      key: null,
      name: row.name,
      quantity: row.quantity === null ? null : Number(row.quantity),
      unit: row.unit,
      shop_section: row.shop_section,
      checked: row.checked,
      is_manual: true,
      changedFrom: null,
    }));

  const { items, removed } = applyMarks(computed.lines, marks);
  return { range, saved: Boolean(list), items: [...items, ...manual], removed, plannedMeals: computed.plannedMeals };
}
