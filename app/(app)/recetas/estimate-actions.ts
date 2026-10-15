"use server";

import { z } from "zod";
import { ImportError } from "@/lib/ai/errors";
import { estimateRecipe } from "@/lib/ai/estimate-recipe";
import { requireUser } from "@/lib/auth-server";
import { listAllTags } from "@/lib/recipes/queries";

export type EstimateResult =
  | { ok: true; prep_minutes: number | null; cook_minutes: number | null; tags: string[] }
  | { ok: false; error: string };

const inputSchema = z.object({
  title: z.string().trim().min(1, "Escribe primero el título.").max(150),
  servings: z.number().int().min(1).max(100),
  ingredients: z.array(z.string().trim().min(1).max(200)).max(100),
  steps: z.array(z.string().trim().min(1).max(2000)).max(100),
});

/** Suggests times and tags from the recipe being edited; nothing is saved. */
export async function estimateRecipeMeta(input: unknown): Promise<EstimateResult> {
  await requireUser();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (parsed.data.steps.length === 0) {
    return { ok: false, error: "Añade al menos un paso para poder estimar." };
  }

  try {
    const result = await estimateRecipe(parsed.data, await listAllTags());
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ImportError) return { ok: false, error: error.message };
    console.error("[estimate] unexpected error:", error);
    return { ok: false, error: "No se pudo estimar. Inténtalo de nuevo." };
  }
}
