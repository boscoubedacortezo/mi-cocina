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

/** Role of the dish in a meal. One per recipe, chosen by the AI. */
export const COURSES = ["desayuno", "entrante", "principal", "acompanamiento", "postre"] as const;
export type Course = (typeof COURSES)[number];

export const COURSE_LABELS: Record<Course, string> = {
  desayuno: "Desayuno y merienda",
  entrante: "Entrante",
  principal: "Principal",
  acompanamiento: "Acompañamiento",
  postre: "Postre",
};

/** What the dish is mostly made of. One per recipe, chosen by the AI. */
export const MAIN_INGREDIENTS = [
  "carne",
  "pescado",
  "verdura",
  "legumbres",
  "pasta_arroz",
  "huevos",
  "fruta_dulce",
] as const;
export type MainIngredient = (typeof MAIN_INGREDIENTS)[number];

export const MAIN_INGREDIENT_LABELS: Record<MainIngredient, string> = {
  carne: "Carne",
  pescado: "Pescado y marisco",
  verdura: "Verdura",
  legumbres: "Legumbres",
  pasta_arroz: "Pasta, arroz y masas",
  huevos: "Huevos",
  fruta_dulce: "Fruta y dulces",
};
