import { z } from "zod";
import { SHOP_SECTIONS, UNITS } from "@/lib/recipes/constants";
import { daysInRange } from "@/lib/menu/dates";
import { isoDateSchema } from "@/lib/menu/schema";

export const manualItemSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre del artículo.").max(120),
  quantity: z.number("La cantidad debe ser un número.").min(0).max(1_000_000).nullable(),
  unit: z.enum(UNITS).nullable(),
  shop_section: z.enum(SHOP_SECTIONS),
});

/** Longest range one list can cover. */
export const MAX_RANGE_DAYS = 63;

export const rangeSchema = z
  .object({ start: isoDateSchema, end: isoDateSchema })
  .superRefine(({ start, end }, ctx) => {
    const days = daysInRange(start, end);
    // Unreadable dates are already reported by the field checks.
    if (Number.isNaN(days)) return;
    if (days < 1) {
      ctx.addIssue({ code: "custom", message: "La fecha final no puede ser anterior a la inicial." });
    } else if (days > MAX_RANGE_DAYS) {
      ctx.addIssue({ code: "custom", message: "Elige un periodo de como máximo 9 semanas." });
    }
  });

/** Days a new list covers when nobody chose a range. */
export const DEFAULT_RANGE_DAYS = 14;
