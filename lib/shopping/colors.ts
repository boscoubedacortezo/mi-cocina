import type { ShopSection } from "@/lib/recipes/constants";

/** A coloured dot per supermarket section, to find your way down a long list. */
export const SECTION_DOT: Record<ShopSection, string> = {
  "Frutas y verduras": "bg-green-500",
  Carne: "bg-red-500",
  Pescado: "bg-sky-500",
  "Lácteos y huevos": "bg-amber-400",
  Panadería: "bg-orange-400",
  Despensa: "bg-yellow-600",
  Congelados: "bg-cyan-400",
  Bebidas: "bg-violet-500",
  Otros: "bg-stone-400",
};
