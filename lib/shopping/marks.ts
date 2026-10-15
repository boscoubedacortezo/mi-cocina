import type { ShopSection, Unit } from "@/lib/recipes/constants";
import type { ShoppingLine } from "./aggregate";
import { formatAmount } from "./format";

/** What the user did to a generated line. */
export type Mark = {
  key: string;
  checked: boolean;
  excluded: boolean;
  /** The quantity needed when the mark was made. */
  marked_quantity: number | null;
  unit: Unit | null;
};

export type ShoppingEntry = {
  /** The row id for items added by hand; the line key for generated ones. */
  id: string;
  /** Null for items added by hand. */
  key: string | null;
  name: string;
  quantity: number | null;
  unit: Unit | null;
  shop_section: ShopSection;
  checked: boolean;
  is_manual: boolean;
  /** Set when more is needed now than when it was ticked or removed: "2 ud". */
  changedFrom: string | null;
};

const TO_BASE: Partial<Record<Unit, number>> = { kg: 1000, l: 1000 };
const base = (quantity: number, unit: Unit | null) => quantity * (unit ? (TO_BASE[unit] ?? 1) : 1);

/** True when `needed` is more than what was marked, comparing g with kg and ml with l. */
export function needGrew(
  needed: { quantity: number | null; unit: Unit | null },
  marked: { quantity: number | null; unit: Unit | null },
) {
  if (needed.quantity === null) return false;
  if (marked.quantity === null) return true;
  return base(needed.quantity, needed.unit) > base(marked.quantity, marked.unit) + 1e-9;
}

/**
 * Combines the lines computed from the menu with the user's marks. A mark holds
 * while the need stays the same or shrinks; if the need grows, the line is pending
 * again and says what it was before. Marks for lines no longer needed are ignored.
 */
export function applyMarks(lines: ShoppingLine[], marks: Mark[]) {
  const byKey = new Map(marks.map((mark) => [mark.key, mark]));
  const items: ShoppingEntry[] = [];
  const removed: ShoppingEntry[] = [];

  for (const line of lines) {
    const mark = byKey.get(line.key);
    const grew =
      mark !== undefined &&
      needGrew(
        { quantity: line.quantity, unit: line.unit },
        { quantity: mark.marked_quantity, unit: mark.unit },
      );
    const active = mark !== undefined && !grew;

    const entry: ShoppingEntry = {
      id: line.key,
      key: line.key,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      shop_section: line.shop_section,
      checked: active && mark.checked,
      is_manual: false,
      changedFrom: grew ? formatAmount(mark.marked_quantity, mark.unit) || null : null,
    };
    if (active && mark.excluded) removed.push(entry);
    else items.push(entry);
  }
  return { items, removed };
}
