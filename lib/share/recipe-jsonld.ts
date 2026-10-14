import { compactSettings } from "@/lib/thermomix/cookidoo";
import type { ThermomixStep } from "@/lib/thermomix/schema";

function isoDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `PT${h ? `${h}H` : ""}${m || !h ? `${m}M` : ""}`;
}

export type SharedRecipe = {
  title: string;
  description: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  tags: string[];
  ingredients: string[];
  steps: ThermomixStep[];
};

/** Step text followed by its settings in Cookidoo notation. */
export function stepWithSettings(step: ThermomixStep) {
  const settings = compactSettings(step);
  const text = step.text.trim();
  return settings ? `${text.replace(/[.\s]+$/, "")} ${settings}` : text;
}

/** Cook time shown when the recipe has none: the sum of the machine times. */
export function resolveCookMinutes(recipe: Pick<SharedRecipe, "cookMinutes" | "steps">) {
  if (recipe.cookMinutes) return recipe.cookMinutes;
  const seconds = recipe.steps.reduce((sum, s) => sum + (s.time_seconds ?? 0), 0);
  return seconds ? Math.ceil(seconds / 60) : null;
}

/** schema.org/Recipe, the markup recipe importers look for. */
export function buildRecipeJsonLd(recipe: SharedRecipe) {
  const cook = resolveCookMinutes(recipe);
  const total = (recipe.prepMinutes ?? 0) + (cook ?? 0);
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    ...(recipe.description && { description: recipe.description }),
    inLanguage: "es",
    recipeYield: `${recipe.servings}`,
    ...(recipe.prepMinutes && { prepTime: isoDuration(recipe.prepMinutes) }),
    ...(cook && { cookTime: isoDuration(cook) }),
    ...(total && { totalTime: isoDuration(total) }),
    ...(recipe.tags.length && { keywords: recipe.tags.join(", ") }),
    recipeIngredient: recipe.ingredients,
    recipeInstructions: recipe.steps.map((step) => ({
      "@type": "HowToStep",
      text: stepWithSettings(step),
    })),
  };
}
