import type { Unit } from "./constants";

const numberFormat = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 2,
});

export function formatQuantity(quantity: number | null) {
  return quantity === null ? "" : numberFormat.format(quantity);
}

export function formatIngredient(item: {
  name: string;
  quantity: number | null;
  unit: Unit | null;
}) {
  const amount = [formatQuantity(item.quantity), item.unit]
    .filter(Boolean)
    .join(" ");
  return amount ? `${amount} de ${item.name}` : item.name;
}

export function formatMinutes(minutes: number | null) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
