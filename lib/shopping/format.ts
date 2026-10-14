import type { ShopSection, Unit } from "@/lib/recipes/constants";
import { SHOP_SECTIONS } from "@/lib/recipes/constants";
import { formatQuantity } from "@/lib/recipes/format";

export function formatAmount(quantity: number | null, unit: Unit | null) {
  if (unit === "al gusto") return "al gusto";
  const amount = formatQuantity(quantity);
  if (!unit) return amount;
  if (unit === "pizca") return `${amount} ${quantity === 1 ? "pizca" : "pizcas"}`;
  return `${amount} ${unit}`;
}

export const capitalize = (text: string) =>
  text.charAt(0).toLocaleUpperCase("es-ES") + text.slice(1);

export type ListItem = {
  name: string;
  quantity: number | null;
  unit: Unit | null;
  shop_section: ShopSection;
  checked: boolean;
};

/** Plain-text list grouped by section, ready for WhatsApp or notes. */
export function buildShoppingText(rangeLabel: string, items: ListItem[]) {
  const blocks = SHOP_SECTIONS.flatMap((section) => {
    const lines = items
      .filter((item) => item.shop_section === section)
      .map((item) => {
        const amount = formatAmount(item.quantity, item.unit);
        return `- ${capitalize(item.name)}${amount ? `: ${amount}` : ""}`;
      });
    return lines.length ? [`${section}\n${lines.join("\n")}`] : [];
  });
  return `Lista de la compra (${rangeLabel})\n\n${blocks.join("\n\n")}`;
}
