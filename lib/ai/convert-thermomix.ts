import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { formatIngredient } from "@/lib/recipes/format";
import type { RecipeDetail } from "@/lib/recipes/queries";
import {
  TM_BUTTERFLY_MAX_SPEED,
  TM_MAX_SECONDS,
} from "@/lib/thermomix/constants";
import type { ThermomixStep } from "@/lib/thermomix/schema";
import { getAnthropic } from "./client";
import { AI_EFFORT, AI_MAX_TOKENS, AI_MODEL } from "./config";
import { ImportError, toImportError } from "./errors";
import { CONVERT_THERMOMIX_SYSTEM } from "./prompts/convert-thermomix";
import { aiThermomixSchema, type AiThermomix } from "./schemas";

function describeRecipe(recipe: RecipeDetail, servings: number) {
  return [
    `Título: ${recipe.title}`,
    recipe.description && `Descripción: ${recipe.description}`,
    `Raciones originales: ${recipe.servings}`,
    `Raciones deseadas: ${servings}`,
    "Ingredientes:",
    ...recipe.ingredients.map(
      (item) => `- ${formatIngredient(item)}${item.optional ? " (opcional)" : ""}`,
    ),
    "Pasos:",
    ...recipe.steps.map((step, index) => `${index + 1}. ${step.text}`),
    recipe.notes && `Notas: ${recipe.notes}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export type ThermomixDraft = {
  servings: number;
  capacity: { peak_ml: number; step: number; fitting_servings: number | null };
  ingredients_text: string;
  steps: ThermomixStep[];
  notes: string | null;
};

/** Cleans the model output and enforces the machine's hard limits. */
function toThermomixDraft(ai: AiThermomix): ThermomixDraft {
  const steps = ai.steps
    .map<ThermomixStep>((step) => {
      let speed = step.speed;
      // Butterfly whisk breaks above speed 4.
      if (
        step.accessory === "mariposa" &&
        speed !== null &&
        (speed === "turbo" ||
          (speed !== "cuchara" && Number(speed) > TM_BUTTERFLY_MAX_SPEED))
      ) {
        speed = String(TM_BUTTERFLY_MAX_SPEED) as ThermomixStep["speed"];
      }
      if (step.mode === "arroz") {
        // Cocción de arroz takes no selectors.
        return {
          text: step.text.trim().slice(0, 2000),
          time_seconds: null,
          temperature: null,
          speed: null,
          reverse: false,
          accessory: step.accessory === "cestillo" ? "cestillo" : null,
          mode: "arroz",
        };
      }
      if (step.mode === "amasar") {
        // Amasar takes only minutes and seconds.
        return {
          text: step.text.trim().slice(0, 2000),
          time_seconds: step.time_seconds
            ? Math.min(Math.max(step.time_seconds, 1), TM_MAX_SECONDS)
            : null,
          temperature: null,
          speed: null,
          reverse: false,
          accessory: null,
          mode: "amasar",
        };
      }
      return {
        text: step.text.trim().slice(0, 2000),
        time_seconds:
          step.time_seconds && step.time_seconds > 0
            ? Math.min(step.time_seconds, TM_MAX_SECONDS)
            : null,
        temperature:
          step.temperature === null
            ? null
            : step.temperature === "Varoma"
              ? "Varoma"
              : Number(step.temperature),
        speed,
        // Spoon speed only exists in reverse.
        reverse: step.reverse || speed === "cuchara",
        accessory: step.accessory,
        mode: null,
      };
    })
    .filter((step) => step.text);

  const servings = Math.min(100, Math.max(1, ai.servings));
  return {
    servings,
    capacity: {
      peak_ml: Math.max(0, ai.capacity.peak_volume_ml),
      step: Math.min(Math.max(1, ai.capacity.busiest_step), Math.max(1, steps.length)),
      // A suggestion that fits means fewer servings than the ones asked for.
      fitting_servings:
        ai.capacity.fitting_servings !== null &&
        ai.capacity.fitting_servings >= 1 &&
        ai.capacity.fitting_servings < servings
          ? ai.capacity.fitting_servings
          : null,
    },
    ingredients_text: ai.ingredients
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n"),
    steps,
    notes: ai.notes?.trim() || null,
  };
}

export async function convertToThermomix(
  recipe: RecipeDetail,
  servings: number,
): Promise<ThermomixDraft> {
  let response;
  try {
    response = await getAnthropic().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: CONVERT_THERMOMIX_SYSTEM,
      output_config: { effort: AI_EFFORT, format: zodOutputFormat(aiThermomixSchema) },
      messages: [
        {
          role: "user",
          content: `Adapta esta receta a la Thermomix TM7.\n\n<receta>\n${describeRecipe(recipe, servings)}\n</receta>`,
        },
      ],
    });
  } catch (error) {
    throw toImportError(error);
  }

  if (response.stop_reason === "refusal") {
    throw new ImportError("La IA no ha podido procesar esta receta.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new ImportError("La receta es demasiado larga para convertirla de una vez.");
  }
  if (!response.parsed_output) {
    throw new ImportError("La IA no devolvió una conversión válida. Inténtalo de nuevo.");
  }
  const draft = toThermomixDraft(response.parsed_output);
  if (draft.steps.length === 0) {
    throw new ImportError("La IA no devolvió pasos. Inténtalo de nuevo.");
  }
  return draft;
}
