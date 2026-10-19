import { z } from "zod";
import { COURSES, EQUIPMENT, MAIN_INGREDIENTS, SHOP_SECTIONS, UNITS } from "@/lib/recipes/constants";
import { TM_ACCESSORIES, TM_MODES, TM_SPEEDS } from "@/lib/thermomix/constants";

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

/** Thermomix conversion. Temperatures are strings so they fit a plain enum. */
export const aiThermomixSchema = z.object({
  servings: z.number().int(),
  ingredients: z.array(z.string()),
  steps: z.array(
    z.object({
      text: z.string(),
      time_seconds: z.number().int().nullable(),
      temperature: z
        .enum([
          "37", "40", "45", "50", "55", "60", "65", "70", "75", "80", "85",
          "90", "95", "98", "100", "105", "110", "115", "120", "Varoma",
        ])
        .nullable(),
      speed: z.enum(TM_SPEEDS).nullable(),
      reverse: z.boolean(),
      accessory: z.enum(TM_ACCESSORIES).nullable(),
      mode: z.enum(TM_MODES).nullable(),
    }),
  ),
  notes: z.string().nullable(),
  /** How full the bowl gets in the busiest step, for the servings as asked (never reduced). */
  capacity: z.object({
    peak_volume_ml: z.number().int(),
    /** 1-based number of that step. */
    busiest_step: z.number().int(),
    /** The most servings that would fit in the bowl, or null if it already fits. */
    fitting_servings: z.number().int().nullable(),
  }),
});

export type AiThermomix = z.infer<typeof aiThermomixSchema>;

/** Weekly menu proposal: one entry per empty slot, null when nothing fits. */
export const aiMenuSchema = z.object({
  assignments: z.array(
    z.object({
      slot: z.string(),
      recipe_id: z.string().nullable(),
    }),
  ),
  notes: z.string().nullable(),
});

export type AiMenu = z.infer<typeof aiMenuSchema>;

/** Estimated times, categories and tags for a recipe that lacks them. */
export const aiEstimateSchema = z.object({
  prep_minutes: z.number().int().nullable(),
  cook_minutes: z.number().int().nullable(),
  course: z.enum(COURSES),
  main_ingredient: z.enum(MAIN_INGREDIENTS),
  equipment: z.array(z.enum(EQUIPMENT)),
  tags: z.array(z.string()),
});

export type AiEstimate = z.infer<typeof aiEstimateSchema>;

/** A recipe's steps rewritten for a different number of servings. */
export const aiAdaptSchema = z.object({
  steps: z.array(z.string()),
  tips: z.array(z.string()),
  prep_minutes: z.number().int().nullable(),
  cook_minutes: z.number().int().nullable(),
});

export type AiAdapt = z.infer<typeof aiAdaptSchema>;
