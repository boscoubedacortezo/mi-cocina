import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { daysBetween, formatDay } from "@/lib/menu/dates";
import type { MenuPreferences } from "@/lib/menu/preferences";
import { getAnthropic } from "./client";
import { AI_EFFORT, AI_MAX_TOKENS, AI_MODEL } from "./config";
import { ImportError, toImportError } from "./errors";
import { buildPlanMenuSystem } from "./prompts/plan-menu";
import { aiMenuSchema } from "./schemas";

export type PlanRecipe = {
  id: string;
  title: string;
  tags: string[];
  course: string | null;
  main: string | null;
  minutes: number | null;
  ingredients: string[];
};

export type PlanRequest = {
  recipes: PlanRecipe[];
  /** Slots already filled: key is "date|meal". */
  fixed: { key: string; recipeId: string }[];
  /** Slots to fill. */
  empty: string[];
  /** Recipes that must not be proposed. */
  exclude: string[];
  /** Recipes planned on nearby days of other weeks. */
  nearby: { date: string; recipeId: string }[];
  preferences: MenuPreferences;
};

const MAX_RECIPES = 200;

function describeSlot(key: string) {
  const [date, meal] = key.split("|");
  return `${key} (${formatDay(date)}, ${meal})`;
}

/**
 * Never trust the output: keep only known recipes and empty slots, and nothing repeated
 * inside the window (slots already filled, nearby weeks and what is assigned here count).
 */
export function enforcePlan(
  proposed: { slot: string; recipe_id: string | null }[],
  request: PlanRequest,
  recipes: { id: string }[],
) {
  const allowed = new Set(recipes.map((r) => r.id));
  const blocked = new Set(request.exclude);
  const emptySlots = new Set(request.empty);
  const occupied = [
    ...request.fixed.map((f) => ({ date: f.key.split("|")[0], recipeId: f.recipeId })),
    ...request.nearby,
  ];
  const window = request.preferences.noRepeatDays;
  const assignments = new Map<string, string>();
  for (const { slot, recipe_id } of proposed) {
    if (!emptySlots.has(slot) || assignments.has(slot)) continue;
    if (!recipe_id || !allowed.has(recipe_id) || blocked.has(recipe_id)) continue;
    const date = slot.split("|")[0];
    const tooClose = occupied.some(
      (other) =>
        other.recipeId === recipe_id &&
        (window > 0 ? Math.abs(daysBetween(other.date, date)) < window : other.date === date),
    );
    if (tooClose) continue;
    assignments.set(slot, recipe_id);
    occupied.push({ date, recipeId: recipe_id });
  }
  return assignments;
}

/** Returns a valid recipe id per slot, or null where nothing fits. */
export async function planMenu(request: PlanRequest) {
  const recipes = request.recipes.slice(0, MAX_RECIPES);
  const titles = new Map(recipes.map((r) => [r.id, r.title]));

  const prompt = [
    "Recetas disponibles:",
    ...recipes.map(
      (r) =>
        `- ${r.id} | ${r.title} | tipo: ${r.course ?? "—"} | principal: ${r.main ?? "—"} | etiquetas: ${r.tags.join(", ") || "—"} | ${r.minutes ? `${r.minutes} min` : "tiempo sin indicar"} | ingredientes: ${r.ingredients.slice(0, 8).join(", ") || "—"}`,
    ),
    "",
    "Huecos fijados por el usuario:",
    ...(request.fixed.length
      ? request.fixed.map(
          (f) => `- ${describeSlot(f.key)}: ${titles.get(f.recipeId) ?? f.recipeId} (${f.recipeId})`,
        )
      : ["(ninguno)"]),
    "",
    "Huecos vacíos que debes rellenar:",
    ...request.empty.map((key) => `- ${describeSlot(key)}`),
    ...(request.exclude.length
      ? ["", "No propongas estas recetas:", ...request.exclude.map((id) => `- ${id} (${titles.get(id) ?? "?"})`)]
      : []),
    ...(request.nearby.length
      ? [
          "",
          "Recetas planificadas en días cercanos de otras semanas:",
          ...request.nearby.map((n) => `- ${n.date}: ${titles.get(n.recipeId) ?? n.recipeId} (${n.recipeId})`),
        ]
      : []),
    ...(request.preferences.notes
      ? ["", "Notas del usuario sobre sus gustos:", request.preferences.notes]
      : []),
  ].join("\n");

  let response;
  try {
    response = await getAnthropic().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: buildPlanMenuSystem(request.preferences),
      output_config: { effort: AI_EFFORT, format: zodOutputFormat(aiMenuSchema) },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (error) {
    throw toImportError(error);
  }

  if (response.stop_reason === "refusal") {
    throw new ImportError("La IA no ha podido proponer un menú.");
  }
  if (!response.parsed_output) {
    throw new ImportError("La IA no devolvió un menú válido. Inténtalo de nuevo.");
  }

  const assignments = enforcePlan(response.parsed_output.assignments, request, recipes);
  const truncated =
    request.recipes.length > MAX_RECIPES
      ? `Solo se han considerado las ${MAX_RECIPES} recetas más recientes.`
      : null;
  const notes = [response.parsed_output.notes?.trim(), truncated].filter(Boolean).join(" ");
  return { assignments, notes: notes || null };
}
