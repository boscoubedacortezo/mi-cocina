import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic } from "./client";
import { AI_EFFORT_LIGHT, AI_MAX_TOKENS, AI_MODEL } from "./config";
import { ImportError, toImportError } from "./errors";
import { CREATE_RECIPE_SYSTEM } from "./prompts/create-recipe";
import { aiRecipeSchema, type AiRecipe } from "./schemas";

/** Writes a full recipe from a short description of the dish. */
export async function createRecipeFromRequest(request: {
  text: string;
  servings: number;
  /** The user's own notes about tastes and restrictions, if any. */
  notes: string;
}): Promise<AiRecipe> {
  const prompt = [
    `Raciones por defecto: ${request.servings}.`,
    request.notes ? `Notas del usuario sobre sus gustos:\n${request.notes}` : "",
    `<peticion>\n${request.text}\n</peticion>`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let response;
  try {
    response = await getAnthropic().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: CREATE_RECIPE_SYSTEM,
      output_config: { effort: AI_EFFORT_LIGHT, format: zodOutputFormat(aiRecipeSchema) },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (error) {
    throw toImportError(error);
  }

  if (response.stop_reason === "refusal") {
    throw new ImportError("La IA no ha podido crear esa receta.");
  }
  if (!response.parsed_output) {
    throw new ImportError("La IA no devolvió una receta válida. Inténtalo de nuevo.");
  }
  return response.parsed_output;
}
