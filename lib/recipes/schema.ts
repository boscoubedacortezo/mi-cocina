import { z } from "zod";
import { COURSES, MAIN_INGREDIENTS, SHOP_SECTIONS, SOURCE_TYPES, UNITS } from "./constants";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => value || null);

const optionalMinutes = z.number().int().min(0).max(24 * 60).nullable();

export const ingredientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Cada ingrediente necesita un nombre.")
    .max(120),
  quantity: z.number().min(0).max(1_000_000).nullable(),
  unit: z.enum(UNITS).nullable(),
  shop_section: z.enum(SHOP_SECTIONS),
  optional: z.boolean(),
});

export const stepSchema = z.object({
  text: z.string().trim().min(1, "Hay un paso vacío.").max(2000),
});

export const recipeInputSchema = z.object({
  title: z.string().trim().min(1, "Pon un título a la receta.").max(150),
  description: optionalText(1000),
  servings: z
    .number("Indica las raciones.")
    .int("Las raciones deben ser un número entero.")
    .min(1, "Mínimo 1 ración.")
    .max(100),
  prep_minutes: optionalMinutes,
  cook_minutes: optionalMinutes,
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(40))
    .max(20)
    .transform((tags) => [...new Set(tags)]),
  course: z.enum(COURSES).nullable(),
  main_ingredient: z.enum(MAIN_INGREDIENTS).nullable(),
  source_type: z.enum(SOURCE_TYPES),
  source_url: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .transform((value) => value || null)
    .refine((value) => value === null || isHttpUrl(value), {
      message: "La URL de origen no es válida.",
    }),
  notes: optionalText(4000),
  image_path: z.string().max(300).nullable(),
  ingredients: z.array(ingredientSchema).max(100),
  steps: z.array(stepSchema).max(100),
});

export type RecipeInput = z.infer<typeof recipeInputSchema>;
export type IngredientInput = z.infer<typeof ingredientSchema>;

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
