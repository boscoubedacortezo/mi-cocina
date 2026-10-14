import { z } from "zod";
import {
  TM_ACCESSORIES,
  TM_MAX_SECONDS,
  TM_SPEEDS,
  TM_TEMPERATURES,
} from "./constants";

export const thermomixStepSchema = z.object({
  text: z.string().trim().min(1, "Hay un paso vacío.").max(2000),
  time_seconds: z.number().int().min(1).max(TM_MAX_SECONDS).nullable(),
  temperature: z
    .union([
      z
        .number()
        .int()
        .refine((t) => (TM_TEMPERATURES as readonly number[]).includes(t), {
          message: "Temperatura no válida.",
        }),
      z.literal("Varoma"),
    ])
    .nullable(),
  speed: z.enum(TM_SPEEDS).nullable(),
  reverse: z.boolean(),
  accessory: z.enum(TM_ACCESSORIES).nullable(),
});

export const thermomixInputSchema = z.object({
  ingredients_text: z.string().trim().max(5000),
  steps: z.array(thermomixStepSchema).max(100),
});

export type ThermomixStep = z.infer<typeof thermomixStepSchema>;
export type ThermomixInput = z.infer<typeof thermomixInputSchema>;
