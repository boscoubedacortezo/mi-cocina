import { z } from "zod";
import { parseIso, weekDates } from "./dates";

export const MEALS = ["comida", "cena"] as const;
export type Meal = (typeof MEALS)[number];

export const DEFAULT_SERVINGS = 4;

const isoDate = z.string().refine((value) => parseIso(value) !== null, "Fecha no válida.");

export const weekStartSchema = isoDate.refine(
  (value) => parseIso(value)!.getUTCDay() === 1,
  "La semana debe empezar en lunes.",
);

export const servingsSchema = z
  .number("Indica las raciones.")
  .int("Las raciones deben ser un número entero.")
  .min(1, "Mínimo 1 ración.")
  .max(100, "Máximo 100 raciones.");

export const slotSchema = z
  .object({ weekStart: weekStartSchema, date: isoDate, meal: z.enum(MEALS) })
  .refine(({ weekStart, date }) => weekDates(weekStart).includes(date), {
    message: "Ese día no pertenece a la semana.",
  });

export const setSlotSchema = z.object({
  slot: slotSchema,
  recipeId: z.uuid(),
  servings: servingsSchema,
});

export const slotKey = (date: string, meal: Meal) => `${date}|${meal}`;
