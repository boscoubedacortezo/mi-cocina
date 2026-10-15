import type { Unit } from "./constants";
import { formatQuantity } from "./format";

const FRACTIONS: [number, string][] = [
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.5, "½"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
];

/** 1.5 -> "1 ½", 0.33 -> "⅓", 2 -> "2"; anything else as a decimal. */
function formatFriendly(quantity: number) {
  const whole = Math.floor(quantity + 1e-9);
  const fraction = quantity - whole;
  if (fraction < 0.02) return String(whole);
  if (fraction > 0.98) return String(whole + 1);
  const match = FRACTIONS.find(([value]) => Math.abs(fraction - value) < 0.02);
  if (match) return whole > 0 ? `${whole} ${match[1]}` : match[1];
  return formatQuantity(quantity);
}

/**
 * Scales one ingredient by `factor`. A pinch or "al gusto" is not proportional
 * to the servings, so those stay as written.
 */
export function scaleAmount(quantity: number | null, unit: Unit | null, factor: number) {
  if (quantity === null || unit === "pizca" || unit === "al gusto") return { quantity, unit };

  let amount = quantity * factor;
  let scaledUnit = unit;
  // Keep the unit readable: 1200 g -> 1.2 kg, 0.5 kg -> 500 g.
  if (scaledUnit === "g" && amount >= 1000) [amount, scaledUnit] = [amount / 1000, "kg"];
  else if (scaledUnit === "kg" && amount < 1) [amount, scaledUnit] = [amount * 1000, "g"];
  else if (scaledUnit === "ml" && amount >= 1000) [amount, scaledUnit] = [amount / 1000, "l"];
  else if (scaledUnit === "l" && amount < 1) [amount, scaledUnit] = [amount * 1000, "ml"];

  amount =
    scaledUnit === "g" || scaledUnit === "ml"
      ? amount >= 10
        ? Math.round(amount)
        : Math.round(amount * 10) / 10
      : Math.round(amount * 100) / 100;
  return { quantity: amount, unit: scaledUnit };
}

/** "300 g", "½ cda": the amount alone. Counts and spoons use fractions. */
export function formatAmount(quantity: number | null, unit: Unit | null) {
  const measured = unit === "g" || unit === "kg" || unit === "ml" || unit === "l";
  return [
    quantity === null ? "" : measured ? formatQuantity(quantity) : formatFriendly(quantity),
    unit,
  ]
    .filter(Boolean)
    .join(" ");
}

/** "300 g de harina", scaled. Counts and spoons use fractions ("½ cebolla"). */
export function formatScaledIngredient(
  item: { name: string; quantity: number | null; unit: Unit | null },
  factor: number,
) {
  if (item.unit === "al gusto") return `${item.name} al gusto`;
  const { quantity, unit } = scaleAmount(item.quantity, item.unit, factor);
  const amount = formatAmount(quantity, unit);
  return amount ? `${amount} de ${item.name}` : item.name;
}
