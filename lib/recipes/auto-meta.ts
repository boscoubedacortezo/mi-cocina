export type AutoMetaMode =
  /** Fill only what is empty (new recipes: imports may bring their own values). */
  | "missing"
  /** The recipe's content changed: recompute the times. */
  | "all";

/**
 * Which details the AI should write when a recipe is saved. Tags and
 * categories belong to the user once set, so the AI only fills them when they
 * are empty (tags only if it is being called anyway). Times are the AI's:
 * filled when both are empty, and recomputed when the content changed ("all").
 */
export function planAutoMeta(
  recipe: {
    prep_minutes: number | null;
    cook_minutes: number | null;
    tags: string[];
    course: string | null;
    main_ingredient: string | null;
    equipment: string[];
    stepCount: number;
    ingredientCount: number;
  },
  mode: AutoMetaMode,
) {
  // Nothing to work from. A recipe with ingredients but no steps (one that is cooked in
  // Cookidoo) can still be classified, but its times are never guessed.
  if (recipe.stepCount === 0 && recipe.ingredientCount === 0) {
    return { times: false, tags: false, categories: false, equipment: false };
  }
  const hasSteps = recipe.stepCount > 0;

  // Tags and categories belong to the user once set: the AI only fills what is
  // empty, in both modes. Times are the AI's, so they are recomputed on "all".
  const times =
    hasSteps && (mode === "all" || (recipe.prep_minutes === null && recipe.cook_minutes === null));
  // Recipes saved before categories existed get theirs on the next save.
  const categories = recipe.course === null || recipe.main_ingredient === null;
  const callsAi = times || categories;
  return {
    times,
    categories,
    // The AI may decide a recipe needs no tags, or that it has no equipment to name, so an
    // empty list alone must not trigger a call on every save: they ride along when it is
    // called anyway. Equipment is read from the steps, so a recipe without steps has none.
    tags: recipe.tags.length === 0 && callsAi,
    equipment: recipe.equipment.length === 0 && hasSteps && callsAi,
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
