import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { formatIngredient } from "@/lib/recipes/format";
import type { RecipeDetail } from "@/lib/recipes/queries";
import { formatScaledIngredient } from "@/lib/recipes/scale";
import { getAnthropic } from "./client";
import { AI_EFFORT, AI_MAX_TOKENS, AI_MODEL } from "./config";
import { ImportError, toImportError } from "./errors";
import { ADAPT_RECIPE_SYSTEM } from "./prompts/adapt-recipe";
import { aiAdaptSchema } from "./schemas";

const minutes = (value: number | null) =>
  value === null || !Number.isFinite(value) ? null : Math.min(24 * 60, Math.max(0, Math.round(value)));

export async function adaptRecipe(recipe: RecipeDetail, servings: number) {
  const factor = servings / recipe.servings;
  const prompt = [
    `Título: ${recipe.title}`,
    `Raciones originales: ${recipe.servings}`,
    `Raciones deseadas: ${servings}`,
    recipe.prep_minutes ? `Preparación original: ${recipe.prep_minutes} min` : null,
    recipe.cook_minutes ? `Cocción original: ${recipe.cook_minutes} min` : null,
    "",
    "Ingredientes originales:",
    ...recipe.ingredients.map((item) => `- ${formatIngredient(item)}`),
    "",
    `Ingredientes escalados a ${servings} raciones (usa estas cantidades):`,
    ...recipe.ingredients.map((item) => `- ${formatScaledIngredient(item, factor)}`),
    "",
    "Pasos originales:",
    ...recipe.steps.map((step, index) => `${index + 1}. ${step.text}`),
  ]
    .filter((line) => line !== null)
    .join("\n");

  let response;
  try {
    response = await getAnthropic().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: ADAPT_RECIPE_SYSTEM,
      output_config: { effort: AI_EFFORT, format: zodOutputFormat(aiAdaptSchema) },
      messages: [{ role: "user", content: `<receta>\n${prompt}\n</receta>` }],
    });
  } catch (error) {
    throw toImportError(error);
  }

  if (response.stop_reason === "refusal") {
    throw new ImportError("La IA no ha podido procesar esta receta.");
  }
  if (!response.parsed_output) {
    throw new ImportError("La IA no devolvió una adaptación válida. Inténtalo de nuevo.");
  }

  const steps = response.parsed_output.steps.map((s) => s.trim().slice(0, 2000)).filter(Boolean);
  if (steps.length === 0) throw new ImportError("La IA no devolvió pasos. Inténtalo de nuevo.");
  return {
    steps,
    tips: response.parsed_output.tips.map((t) => t.trim()).filter(Boolean).slice(0, 4),
    prep_minutes: minutes(response.parsed_output.prep_minutes),
    cook_minutes: minutes(response.parsed_output.cook_minutes),
  };
}
