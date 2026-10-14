import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AI_TIMEOUT_MS } from "./config";

let client: Anthropic | undefined;

/** Server-only Anthropic client. The API key is read from ANTHROPIC_API_KEY. */
export function getAnthropic() {
  client ??= new Anthropic({ timeout: AI_TIMEOUT_MS, maxRetries: 1 });
  return client;
}
