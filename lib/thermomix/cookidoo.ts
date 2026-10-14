import { TM_MODE_LABELS } from "./constants";
import type { ThermomixStep } from "./schema";

export function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} seg`;
  return seconds ? `${minutes} min ${seconds} seg` : `${minutes} min`;
}

/** Machine settings of a step, in Cookidoo order: time / temp / speed / reverse / accessory. */
export function stepSettings(step: ThermomixStep) {
  if (step.mode === "arroz") return [TM_MODE_LABELS.arroz];
  const parts: string[] = [];
  if (step.mode === "amasar") {
    parts.push(TM_MODE_LABELS.amasar);
    if (step.time_seconds) parts.push(formatTime(step.time_seconds));
    return parts;
  }
  if (step.time_seconds) parts.push(formatTime(step.time_seconds));
  if (step.temperature !== null) {
    parts.push(step.temperature === "Varoma" ? "Varoma" : `${step.temperature} °C`);
  }
  if (step.speed) parts.push(`vel ${step.speed}`);
  if (step.reverse) parts.push("giro inverso");
  if (step.accessory) parts.push(step.accessory);
  return parts;
}

export function buildIngredientsBlock(ingredientsText: string) {
  return ingredientsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function buildStepsBlock(steps: ThermomixStep[]) {
  return steps
    .map((step, index) => {
      const settings = stepSettings(step);
      const text = step.text.trim();
      const line = settings.length
        ? `${text.replace(/[.\s]+$/, "")} — ${settings.join(" / ")}`
        : text;
      return `${index + 1}. ${line}`;
    })
    .join("\n");
}

/** Text ready to paste into Cookidoo ("Creadas por mí"). */
export function buildCookidooText(ingredientsText: string, steps: ThermomixStep[]) {
  return `Ingredientes\n${buildIngredientsBlock(ingredientsText)}\n\nPasos\n${buildStepsBlock(steps)}`;
}

/** Cook time to show: the recipe's own, or the sum of the machine times. */
export function resolveCookMinutes(cookMinutes: number | null, steps: ThermomixStep[]) {
  if (cookMinutes) return cookMinutes;
  const seconds = steps.reduce((sum, step) => sum + (step.time_seconds ?? 0), 0);
  return seconds ? Math.ceil(seconds / 60) : null;
}

/** Total time: preparation plus cooking (see `resolveCookMinutes`). */
export function resolveTotalMinutes(
  prepMinutes: number | null,
  cookMinutes: number | null,
  steps: ThermomixStep[],
) {
  const total = (prepMinutes ?? 0) + (resolveCookMinutes(cookMinutes, steps) ?? 0);
  return total || null;
}
