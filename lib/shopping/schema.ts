import { z } from "zod";
import { SHOP_SECTIONS, UNITS } from "@/lib/recipes/constants";
import { weekStartSchema } from "@/lib/menu/schema";

export const manualItemSchema = z.object({
  weekStart: weekStartSchema,
  name: z.string().trim().min(1, "Escribe el nombre del artículo.").max(120),
  quantity: z.number("La cantidad debe ser un número.").min(0).max(1_000_000).nullable(),
  unit: z.enum(UNITS).nullable(),
  shop_section: z.enum(SHOP_SECTIONS),
});
