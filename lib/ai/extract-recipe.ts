import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic } from "./client";
import { AI_EFFORT, AI_MAX_TOKENS, AI_MODEL } from "./config";
import { ImportError, toImportError } from "./errors";
import { IMPORT_RECIPE_SYSTEM } from "./prompts/import-recipe";
import { aiRecipeSchema, type AiRecipe } from "./schemas";

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export type ExtractInput =
  | { kind: "text"; text: string }
  | { kind: "images"; images: { mediaType: ImageMediaType; data: string }[] };

function buildContent(input: ExtractInput): Anthropic.Beta.BetaContentBlockParam[] {
  if (input.kind === "text") {
    return [
      {
        type: "text",
        text: `Extrae la receta del siguiente origen.\n\n<origen>\n${input.text}\n</origen>`,
      },
    ];
  }
  return [
    ...input.images.map(
      (image): Anthropic.Beta.BetaImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: image.mediaType, data: image.data },
      }),
    ),
    {
      type: "text",
      text:
        input.images.length > 1
          ? "Extrae la receta de estas fotos (son páginas de una misma receta, en orden)."
          : "Extrae la receta de esta foto.",
    },
  ];
}

/** Sends the source to Claude and returns the validated recipe. */
export async function extractRecipe(input: ExtractInput): Promise<AiRecipe> {
  let response;
  try {
    response = await getAnthropic().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      // A classifier refusal is retried server-side on Anthropic's recommended model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: IMPORT_RECIPE_SYSTEM,
      output_config: { effort: AI_EFFORT, format: zodOutputFormat(aiRecipeSchema) },
      messages: [{ role: "user", content: buildContent(input) }],
    });
  } catch (error) {
    throw toImportError(error);
  }

  if (response.stop_reason === "refusal") {
    throw new ImportError("La IA no ha podido procesar este contenido.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new ImportError("La receta es demasiado larga para procesarla de una vez.");
  }
  if (!response.parsed_output) {
    throw new ImportError("La IA no devolvió una receta válida. Inténtalo de nuevo.");
  }
  return response.parsed_output;
}
