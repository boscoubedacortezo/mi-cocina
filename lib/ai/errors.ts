import Anthropic from "@anthropic-ai/sdk";

/** Error whose message is safe and useful to show to the user (in Spanish). */
export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

/** Maps SDK failures to a message that is safe to show to the user. */
export function toImportError(error: unknown) {
  console.error("[ai] request failed:", error);
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new ImportError("La clave de Anthropic no es válida. Revisa ANTHROPIC_API_KEY.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ImportError("La IA está saturada ahora mismo. Espera un minuto e inténtalo de nuevo.");
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new ImportError("La IA ha tardado demasiado. Inténtalo de nuevo o prueba con menos contenido.");
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ImportError("No se pudo conectar con la IA. Inténtalo de nuevo.");
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new ImportError("La IA no pudo leer el contenido (¿imagen demasiado grande o corrupta?).");
  }
  return new ImportError("Error al consultar la IA. Inténtalo de nuevo.");
}
