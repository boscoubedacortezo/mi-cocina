import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic } from "./client";
import { AI_EFFORT_LIGHT, AI_MAX_TOKENS, AI_MODEL } from "./config";
import { ImportError, toImportError } from "./errors";
import { ESTIMATE_RECIPE_SYSTEM } from "./prompts/estimate-recipe";
import { aiEstimateSchema } from "./schemas";

export type EstimateInput = {
  title: string;
  servings: number;
  ingredients: string[];
  steps: string[];
};

const clampMinutes = (value: number | null) =>
  value === null || !Number.isFinite(value) ? null : Math.min(24 * 60, Math.max(0, Math.round(value)));

export async function estimateRecipe(
  input: EstimateInput,
  existingTags: string[],
  options: { timeoutMs: number },
) {
  const prompt = [
    `Título: ${input.title}`,
    `Raciones: ${input.servings}`,
    "Ingredientes:",
    ...input.ingredients.map((line) => `- ${line}`),
    "Pasos:",
    ...input.steps.map((text, index) => `${index + 1}. ${text}`),
    "",
    existingTags.length
      ? `Etiquetas que el usuario ya utiliza: ${existingTags.join(", ")}`
      : "El usuario todavía no tiene etiquetas.",
  ].join("\n");

  let response;
  try {
    response = await getAnthropic().beta.messages.parse(
      {
        model: AI_MODEL,
        max_tokens: AI_MAX_TOKENS,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: ESTIMATE_RECIPE_SYSTEM,
        output_config: { effort: AI_EFFORT_LIGHT, format: zodOutputFormat(aiEstimateSchema) },
        messages: [{ role: "user", content: `<receta>\n${prompt}\n</receta>` }],
      },
      // Saving a recipe must not hang on this: fail fast and skip it.
      { timeout: options.timeoutMs, maxRetries: 0 },
    );
  } catch (error) {
    throw toImportError(error);
  }

  if (response.stop_reason === "refusal") {
    throw new ImportError("La IA no ha podido procesar esta receta.");
  }
  if (!response.parsed_output) {
    throw new ImportError("La IA no devolvió una estimación válida. Inténtalo de nuevo.");
  }

  const { prep_minutes, cook_minutes, course, main_ingredient, tags } = response.parsed_output;
  return {
    prep_minutes: clampMinutes(prep_minutes),
    cook_minutes: clampMinutes(cook_minutes),
    course,
    main_ingredient,
    tags: [...new Set(tags.map((tag) => tag.trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 4),
  };
}
