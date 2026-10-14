import {
  SHOP_SECTIONS,
  type ShopSection,
  type Unit,
} from "@/lib/recipes/constants";
import { normalizeName } from "./normalize";
import { UNIT_WEIGHTS } from "./unit-weights";

export type SourceIngredient = {
  name: string;
  quantity: number | null;
  unit: Unit | null;
  shop_section: ShopSection;
};

export type ShoppingLine = {
  /** Identity of the line: same product in the same kind of unit. */
  key: string;
  name: string;
  quantity: number | null;
  unit: Unit | null;
  shop_section: ShopSection;
};

type Family = "mass" | "volume" | "none" | Exclude<Unit, "g" | "kg" | "ml" | "l">;

/** Units of one family are summed together; different families stay apart. */
function familyOf(unit: Unit | null): { family: Family; toBase: number } {
  switch (unit) {
    case "g":
      return { family: "mass", toBase: 1 };
    case "kg":
      return { family: "mass", toBase: 1000 };
    case "ml":
      return { family: "volume", toBase: 1 };
    case "l":
      return { family: "volume", toBase: 1000 };
    case null:
      return { family: "none", toBase: 1 };
    default:
      return { family: unit, toBase: 1 };
  }
}

export function lineKey(name: string, unit: Unit | null) {
  return `${normalizeName(name)}|${familyOf(unit).family}`;
}

const round = (value: number) => Math.round(value * 100) / 100;

const sectionOrder = (section: ShopSection) => SHOP_SECTIONS.indexOf(section);

type Accumulator = {
  name: string;
  section: ShopSection;
  family: Family;
  base: number;
  hasQuantity: boolean;
};

/**
 * Sums the ingredients of every recipe in the menu. `factor` scales a recipe
 * from its own servings to the servings planned in the menu.
 */
export function aggregateIngredients(
  entries: { factor: number; ingredients: SourceIngredient[] }[],
): ShoppingLine[] {
  const lines = new Map<string, Accumulator>();

  for (const { factor, ingredients } of entries) {
    for (const item of ingredients) {
      const name = item.name.trim();
      const normalized = normalizeName(name);
      if (!normalized) continue;

      const { family, toBase } = familyOf(item.unit);
      const key = `${normalized}|${family}`;
      const line = lines.get(key) ?? {
        name,
        section: item.shop_section,
        family,
        base: 0,
        hasQuantity: false,
      };
      // The first section other than "Otros" wins when recipes disagree.
      if (line.section === "Otros") line.section = item.shop_section;
      if (item.quantity !== null && family !== "al gusto") {
        line.base += item.quantity * factor * toBase;
        line.hasQuantity = true;
      }
      lines.set(key, line);
    }
  }

  // "2 ud" + "200 g" of a product with a known piece weight are one count.
  for (const [key, line] of [...lines]) {
    if (line.family !== "mass") continue;
    const normalized = key.slice(0, key.lastIndexOf("|"));
    const weight = UNIT_WEIGHTS[normalized];
    const pieces = lines.get(`${normalized}|ud`);
    if (!weight || !pieces) continue;
    pieces.base += line.base / weight;
    pieces.hasQuantity = true;
    if (pieces.section === "Otros") pieces.section = line.section;
    lines.delete(key);
  }

  return [...lines.entries()]
    .map(([key, line]): ShoppingLine => {
      const base = { key, name: line.name, shop_section: line.section };
      if (line.family === "mass") {
        const big = line.base >= 1000;
        return { ...base, quantity: round(big ? line.base / 1000 : line.base), unit: big ? "kg" : "g" };
      }
      if (line.family === "volume") {
        const big = line.base >= 1000;
        return { ...base, quantity: round(big ? line.base / 1000 : line.base), unit: big ? "l" : "ml" };
      }
      if (line.family === "al gusto") return { ...base, quantity: null, unit: "al gusto" };
      if (line.family === "none") {
        return { ...base, quantity: line.hasQuantity ? round(line.base) : null, unit: null };
      }
      // Whole pieces are bought, so a count is rounded up once everything is summed.
      const quantity =
        line.family === "ud" ? Math.ceil(round(line.base)) : round(line.base);
      return {
        ...base,
        quantity: line.hasQuantity ? quantity : null,
        unit: line.hasQuantity ? line.family : null,
      };
    })
    .sort(
      (a, b) =>
        sectionOrder(a.shop_section) - sectionOrder(b.shop_section) ||
        a.name.localeCompare(b.name, "es"),
    );
}
