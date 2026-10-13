export const UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "ud",
  "cda",
  "cdta",
  "pizca",
  "al gusto",
] as const;
export type Unit = (typeof UNITS)[number];

export const SHOP_SECTIONS = [
  "Frutas y verduras",
  "Carne",
  "Pescado",
  "Lácteos y huevos",
  "Panadería",
  "Despensa",
  "Congelados",
  "Bebidas",
  "Otros",
] as const;
export type ShopSection = (typeof SHOP_SECTIONS)[number];

export const SOURCE_TYPES = ["manual", "texto", "url", "foto"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const RECIPE_IMAGES_BUCKET = "recipe-images";
