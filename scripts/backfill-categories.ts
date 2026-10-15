/**
 * One-off: classify existing recipes that have no course / main ingredient yet.
 * It only fills those two fields; times and tags are left alone.
 *
 *   npx tsx --conditions react-server --env-file=.env.local scripts/backfill-categories.ts          # shows what it would do
 *   npx tsx --conditions react-server --env-file=.env.local scripts/backfill-categories.ts --apply  # writes it
 *
 * Uses the service-role key (bypasses RLS) and your Anthropic key, so run it on
 * your own machine only.
 */
import { createClient } from "@supabase/supabase-js";
import { estimateRecipe } from "@/lib/ai/estimate-recipe";
import { COURSE_LABELS, MAIN_INGREDIENT_LABELS } from "@/lib/recipes/constants";
import { formatIngredient } from "@/lib/recipes/format";

const apply = process.argv.includes("--apply");

type Row = {
  id: string;
  title: string;
  servings: number;
  tags: string[];
  course: keyof typeof COURSE_LABELS | null;
  main_ingredient: keyof typeof MAIN_INGREDIENT_LABELS | null;
  recipe_ingredients: { name: string; quantity: number | null; unit: never; position: number }[];
  recipe_steps: { text: string; position: number }[];
};

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, title, servings, tags, course, main_ingredient, recipe_ingredients(name, quantity, unit, position), recipe_steps(text, position)",
    )
    .or("course.is.null,main_ingredient.is.null")
    .returns<Row[]>();
  if (error) throw new Error(`No se pudieron leer las recetas: ${error.message}`);

  const { data: allTags } = await supabase.from("recipes").select("tags");
  const existingTags = [...new Set((allTags ?? []).flatMap((row) => row.tags as string[]))];

  console.log(`${data.length} receta(s) sin clasificar. ${apply ? "Escribiendo cambios." : "Simulación: no se escribe nada."}\n`);

  let done = 0;
  for (const recipe of data) {
    const steps = [...recipe.recipe_steps].sort((a, b) => a.position - b.position);
    if (steps.length === 0) {
      console.log(`- ${recipe.title}: sin pasos, se omite`);
      continue;
    }
    try {
      const estimate = await estimateRecipe(
        {
          title: recipe.title,
          servings: recipe.servings,
          ingredients: [...recipe.recipe_ingredients]
            .sort((a, b) => a.position - b.position)
            .map((item) => formatIngredient({ ...item, quantity: item.quantity === null ? null : Number(item.quantity) })),
          steps: steps.map((step) => step.text),
        },
        existingTags,
        { timeoutMs: 30_000 },
      );

      // Only fill what is missing; never overwrite a category already set.
      const patch = {
        ...(recipe.course === null && { course: estimate.course }),
        ...(recipe.main_ingredient === null && { main_ingredient: estimate.main_ingredient }),
      };
      console.log(
        `- ${recipe.title}: ${COURSE_LABELS[patch.course ?? recipe.course!]} / ${MAIN_INGREDIENT_LABELS[patch.main_ingredient ?? recipe.main_ingredient!]}`,
      );
      if (apply) {
        const { error: updateError } = await supabase.from("recipes").update(patch).eq("id", recipe.id);
        if (updateError) throw new Error(updateError.message);
      }
      done++;
    } catch (err) {
      console.log(`- ${recipe.title}: ERROR ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\n${done} receta(s) ${apply ? "actualizadas" : "se actualizarían (usa --apply para escribirlas)"}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
