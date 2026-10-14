import { z } from "zod";
import { SHOP_SECTIONS, UNITS } from "@/lib/recipes/constants";

/**
 * Shape the model must return. Kept to plain types (no refinements or
 * transforms) so it converts to a JSON schema for structured outputs;
 * real limits are enforced afterwards in `toRecipeDraft`.
 */
export const aiRecipeSchema = z.object({
  is_recipe: z.boolean(),
  title: z.string(),
  description: z.string().nullable(),
  servings: z.number().int().nullable(),
  prep_minutes: z.number().int().nullable(),
  cook_minutes: z.number().int().nullable(),
  tags: z.array(z.string()),
  ingredients: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable(),
      unit: z.enum(UNITS).nullable(),
      shop_section: z.enum(SHOP_SECTIONS),
      optional: z.boolean(),
    }),
  ),
  steps: z.array(z.string()),
  notes: z.string().nullable(),
});

export type AiRecipe = z.infer<typeof aiRecipeSchema>;
