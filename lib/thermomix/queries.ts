import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { thermomixStepSchema, type ThermomixStep } from "./schema";

export type ThermomixVersion = {
  id: string;
  ingredients_text: string;
  steps: ThermomixStep[];
  cookidoo_text: string;
};

export async function getThermomixVersion(
  recipeId: string,
): Promise<ThermomixVersion | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("thermomix_versions")
    .select("id, ingredients_text, steps, cookidoo_text")
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
    ingredients_text: data.ingredients_text,
    steps: steps.data,
    cookidoo_text: data.cookidoo_text ?? "",
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
