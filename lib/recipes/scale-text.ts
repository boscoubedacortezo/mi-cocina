import type { Unit } from "./constants";
import { formatAmount, scaleAmount } from "./scale";

export type TextSegment = { text: string; scaled: boolean };

type Ingredient = { quantity: number | null; unit: Unit | null };

// "200 g", "1,5 l", "2 cucharadas", "1/2 cdta"... Longest names first so
// "gramos" is not read as "g" followed by letters (the \b guards the rest).
const TOKEN =
  /(\d+\/\d+|\d+(?:[.,]\d+)?)\s*(kg|gramos?|gr|g|ml|litros?|l|cucharaditas?|cdtas?|cdta|cucharadas?|cdas?|cda)\b/giu;

const UNIT_ALIASES: Record<string, Unit> = {
  kg: "kg",
  g: "g",
  gr: "g",
  gramo: "g",
  gramos: "g",
  ml: "ml",
  l: "l",
  litro: "l",
  litros: "l",
  cda: "cda",
  cdas: "cda",
  cucharada: "cda",
  cucharadas: "cda",
  cdta: "cdta",
  cdtas: "cdta",
  cucharadita: "cdta",
  cucharaditas: "cdta",
};

const TO_BASE: Partial<Record<Unit, number>> = { kg: 1000, l: 1000 };

function parseNumber(raw: string) {
  if (raw.includes("/")) {
    const [numerator, denominator] = raw.split("/").map(Number);
    return numerator / denominator;
  }
  return Number(raw.replace(",", "."));
}

/** Quantity in g / ml / spoons, so "1 kg" and "1000 g" compare equal. */
const toBase = (quantity: number, unit: Unit) => quantity * (TO_BASE[unit] ?? 1);

const sameFamily = (a: Unit, b: Unit) =>
  (a === "g" || a === "kg") && (b === "g" || b === "kg")
    ? true
    : (a === "ml" || a === "l") && (b === "ml" || b === "l")
      ? true
      : a === b;

/**
 * Scales the quantities a step names, but only those that match an ingredient
 * of the recipe (same amount and unit). "5 minutos" or "180 °C" never do, so
 * they are left alone. Anything written differently ("una taza") is not scaled.
 */
export function scaleStepText(
  text: string,
  ingredients: Ingredient[],
  factor: number,
): TextSegment[] {
  if (factor === 1) return [{ text, scaled: false }];

  const known = ingredients.flatMap((item) =>
    item.quantity !== null && item.unit ? [{ quantity: item.quantity, unit: item.unit }] : [],
  );

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(TOKEN)) {
    const unit = UNIT_ALIASES[match[2].toLowerCase()];
    const quantity = parseNumber(match[1]);
    if (!unit || !Number.isFinite(quantity)) continue;

    const isIngredientAmount = known.some(
      (item) =>
        sameFamily(item.unit, unit) &&
        Math.abs(toBase(item.quantity, item.unit) - toBase(quantity, unit)) < 1e-6,
    );
    if (!isIngredientAmount) continue;

    const scaled = scaleAmount(quantity, unit, factor);
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ text: text.slice(cursor, index), scaled: false });
    segments.push({ text: formatAmount(scaled.quantity, scaled.unit), scaled: true });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), scaled: false });
  return segments.length ? segments : [{ text, scaled: false }];
}
