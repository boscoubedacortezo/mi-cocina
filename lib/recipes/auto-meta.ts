/**
 * Which missing details the AI may fill in when a recipe is saved. It never
 * touches what the user wrote: times only when both are empty (a salad has no
 * cooking time on purpose), tags only when there are none.
 */
export function planAutoMeta(recipe: {
  prep_minutes: number | null;
  cook_minutes: number | null;
  tags: string[];
  stepCount: number;
}) {
  if (recipe.stepCount === 0) return { times: false, tags: false };
  return {
    times: recipe.prep_minutes === null && recipe.cook_minutes === null,
    tags: recipe.tags.length === 0,
  };
}
