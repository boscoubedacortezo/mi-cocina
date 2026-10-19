import "server-only";
import { classifySections } from "@/lib/ai/classify-sections";
import type { ShopSection } from "./constants";
import { guessShopSection } from "./shop-section";

/**
 * Fills in the supermarket section of ingredients that do not have a real one yet ("Otros"):
 * first from the dictionary, then (only for what it does not know) from the AI. Ingredients
 * that already have a section keep it.
 */
export async function resolveShopSections<T extends { name: string; shop_section: ShopSection }>(
  items: T[],
): Promise<T[]> {
  const known = new Map<number, ShopSection>();
  const unknown: string[] = [];
  items.forEach((item, index) => {
    if (item.shop_section !== "Otros") return;
    const guess = guessShopSection(item.name);
    if (guess) known.set(index, guess);
    else unknown.push(item.name);
  });
  const fromAi = unknown.length ? await classifySections(unknown) : new Map<string, ShopSection>();
  return items.map((item, index) => ({
    ...item,
    shop_section: known.get(index) ?? fromAi.get(item.name.trim()) ?? item.shop_section,
  }));
}
