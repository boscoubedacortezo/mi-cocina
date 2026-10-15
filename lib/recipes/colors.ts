import type { MainIngredient } from "./constants";

/** One colour per main ingredient, so a card says what it is at a glance. Tinted, never loud. */
export const MAIN_INGREDIENT_COLORS: Record<MainIngredient, string> = {
  carne: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  pescado: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  verdura: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  legumbres: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  pasta_arroz: "bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200",
  huevos: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  fruta_dulce: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200",
};
