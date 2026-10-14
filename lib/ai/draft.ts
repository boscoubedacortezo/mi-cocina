import type { RecipeDraft } from "@/lib/recipes/draft";
import type { AiRecipe } from "./schemas";

const DEFAULT_SERVINGS = 4;

function clampInt(value: number | null, min: number, max: number) {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Cleans the model output into something the recipe form can show. */
export function toRecipeDraft(
  ai: AiRecipe,
  sourceUrl: string | null,
): RecipeDraft {
  const tags = [
    ...new Set(
      ai.tags
        .map((tag) => tag.trim().toLowerCase().slice(0, 40))
        .filter(Boolean),
    ),
  ].slice(0, 8);

  return {
    title: ai.title.trim().slice(0, 150),
    description: ai.description?.trim().slice(0, 1000) || null,
    servings: clampInt(ai.servings, 1, 100) ?? DEFAULT_SERVINGS,
    prep_minutes: clampInt(ai.prep_minutes, 0, 24 * 60),
    cook_minutes: clampInt(ai.cook_minutes, 0, 24 * 60),
    tags,
    source_url: sourceUrl,
    notes: ai.notes?.trim().slice(0, 4000) || null,
    ingredients: ai.ingredients
      .map((item) => ({
        ...item,
        name: item.name.trim().slice(0, 120),
        quantity:
          item.quantity === null || !Number.isFinite(item.quantity)
            ? null
            : Math.min(1_000_000, Math.max(0, item.quantity)),
      }))
      .filter((item) => item.name),
    steps: ai.steps
      .map((text) => ({ text: text.trim().slice(0, 2000) }))
      .filter((step) => step.text),
  };
}
