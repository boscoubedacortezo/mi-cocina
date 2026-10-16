import { z } from "zod";
import { MEALS } from "./schema";

/** Main ingredients the user can ask a minimum of per week. */
export const WEEKLY_MINIMUMS = ["pescado", "legumbres", "verdura"] as const;
export type WeeklyMinimum = (typeof WEEKLY_MINIMUMS)[number];

const FIELDS = {
  servings: z.number().int().min(1, "Mínimo 1 ración.").max(100, "Máximo 100 raciones."),
  meals: z
    .array(z.enum(MEALS))
    .min(1, "Elige al menos una comida.")
    .transform((list) => MEALS.filter((meal) => list.includes(meal))),
  /** Days that must pass before a recipe can come back; 0 allows repeating. */
  noRepeatDays: z.number().int().min(0).max(90, "Máximo 90 días."),
  onlyMains: z.boolean(),
  varietyMain: z.boolean(),
  minPerWeek: z.object({
    pescado: z.number().int().min(0).max(14),
    legumbres: z.number().int().min(0).max(14),
    verdura: z.number().int().min(0).max(14),
  }),
  longerOnWeekend: z.boolean(),
  notes: z.string().trim().max(500, "Máximo 500 caracteres."),
};

export type MenuPreferences = {
  servings: number;
  meals: (typeof MEALS)[number][];
  noRepeatDays: number;
  onlyMains: boolean;
  varietyMain: boolean;
  minPerWeek: Record<WeeklyMinimum, number>;
  longerOnWeekend: boolean;
  notes: string;
};

/** What the menu did before preferences existed. */
export const DEFAULT_MENU_PREFERENCES: MenuPreferences = {
  servings: 4,
  meals: ["comida", "cena"],
  noRepeatDays: 7,
  onlyMains: true,
  varietyMain: true,
  minPerWeek: { pescado: 0, legumbres: 0, verdura: 0 },
  longerOnWeekend: true,
  notes: "",
};

/** Strict, for saving: every field must be valid. */
export const menuPreferencesSchema = z.object(FIELDS);

/** Lenient, for reading: a missing or invalid field falls back to its default. */
export function parseMenuPreferences(raw: unknown): MenuPreferences {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const result: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(FIELDS)) {
    const parsed = schema.safeParse(source[key]);
    result[key] = parsed.success
      ? parsed.data
      : DEFAULT_MENU_PREFERENCES[key as keyof MenuPreferences];
  }
  return result as MenuPreferences;
}
