import { normalizeIngredient } from "@/lib/recipes/shop-section";

/** How a pantry entry is stored: lower case, no accents, single spaces. */
export function pantryKey(name: string) {
  return normalizeIngredient(name);
}

/**
 * Whether a shopping line is something the user always has. "aceite" covers "aceite de oliva
 * virgen extra" and "sal" covers "sal gruesa", but not "salsa de soja": the entry has to be
 * the whole name or its first words.
 */
export function inPantry(lineName: string, pantry: string[]) {
  const name = pantryKey(lineName);
  if (!name) return false;
  return pantry.some((entry) => entry !== "" && (name === entry || name.startsWith(`${entry} `)));
}
