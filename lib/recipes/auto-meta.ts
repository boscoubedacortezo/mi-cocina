export type AutoMetaMode =
  /** Fill only what is empty (new recipes: imports may bring their own values). */
  | "missing"
  /** The recipe's content changed: recompute everything. */
  | "all";

/**
 * Which details the AI should write when a recipe is saved. In "missing" mode
 * it never touches what exists: times only when both are empty (a salad has no
 * cooking time on purpose), categories only when one is missing, tags only when
 * there are none and the AI is being called anyway.
 */
export function planAutoMeta(
  recipe: {
    prep_minutes: number | null;
    cook_minutes: number | null;
    tags: string[];
    course: string | null;
    main_ingredient: string | null;
    stepCount: number;
  },
  mode: AutoMetaMode,
) {
  if (recipe.stepCount === 0) return { times: false, tags: false, categories: false };
  if (mode === "all") return { times: true, tags: true, categories: true };
  const times = recipe.prep_minutes === null && recipe.cook_minutes === null;
  // Recipes saved before categories existed get theirs on the next save.
  const categories = recipe.course === null || recipe.main_ingredient === null;
  return {
    times,
    categories,
    // The AI may decide a recipe needs no tags, so an empty list alone must not
    // trigger a call on every save: tags ride along when it is called anyway.
    tags: recipe.tags.length === 0 && (times || categories),
  };
}

const norm = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Fingerprint of what the times and tags are derived from. Two saves with the
 * same fingerprint need no new estimate (photo, servings or notes changed).
 */
export function contentSignature(recipe: {
  title: string;
  ingredients: { name: string; quantity: number | string | null; unit: string | null }[];
  steps: { text: string }[];
}) {
  return JSON.stringify([
    norm(recipe.title),
    recipe.ingredients.map((item) => [
      norm(item.name),
      item.quantity === null ? null : Number(item.quantity),
      item.unit,
    ]),
    recipe.steps.map((step) => norm(step.text)),
  ]);
}
