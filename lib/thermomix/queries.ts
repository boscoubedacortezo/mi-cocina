import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { thermomixStepSchema, type ThermomixStep } from "./schema";

export type ThermomixVersion = {
  id: string;
  /** Null for versions saved before servings were stored. */
  servings: number | null;
  notes: string | null;
  /** Fingerprint of the recipe when converted; null for versions made before it existed. */
  source_signature: string | null;
  ingredients_text: string;
  steps: ThermomixStep[];
  cookidoo_text: string;
  /** How full the bowl gets; null for versions made before this was measured. */
  capacity: BowlCapacity | null;
};

export type BowlCapacity = { peak_ml: number; step: number; fitting_servings: number | null };

const capacitySchema = z.object({
  peak_ml: z.number(),
  step: z.number(),
  fitting_servings: z.number().nullable(),
});

export async function getThermomixVersion(
  recipeId: string,
): Promise<ThermomixVersion | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("thermomix_versions")
    .select("id, servings, notes, source_signature, ingredients_text, steps, cookidoo_text, capacity")
    .eq("recipe_id", recipeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar la versión Thermomix.");
  if (!data) return null;

  const steps = z.array(thermomixStepSchema).safeParse(data.steps);
  if (!steps.success) throw new Error("La versión Thermomix guardada no es válida.");
  return {
    id: data.id,
    servings: data.servings,
    notes: data.notes,
    source_signature: data.source_signature,
    ingredients_text: data.ingredients_text,
    steps: steps.data,
    cookidoo_text: data.cookidoo_text ?? "",
    capacity: capacitySchema.safeParse(data.capacity).data ?? null,
  };
}

export async function hasThermomixVersion(recipeId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("thermomix_versions")
    .select("id", { count: "exact", head: true })
    .eq("recipe_id", recipeId);
  return (count ?? 0) > 0;
}
