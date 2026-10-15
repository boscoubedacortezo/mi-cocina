/**
 * One-off: classify existing recipes that lack a course, a main ingredient or how they
 * are cooked. It only fills what is missing; times, tags and anything already set stay.
 *
 *   npx tsx --conditions react-server --env-file=.env.local scripts/backfill-categories.ts          # shows what it would do
 *   npx tsx --conditions react-server --env-file=.env.local scripts/backfill-categories.ts --apply  # writes it
 *
 * Uses the service-role key (bypasses RLS) and your Anthropic key, so run it on
 * your own machine only.
 */
import { createClient } from "@supabase/supabase-js";
import { estimateRecipe } from "@/lib/ai/estimate-recipe";
import { COURSE_LABELS, EQUIPMENT_LABELS, MAIN_INGREDIENT_LABELS, type Equipment } from "@/lib/recipes/constants";
import { isCookidooUrl } from "@/lib/recipes/cookidoo-url";
import { formatIngredient } from "@/lib/recipes/format";

const apply = process.argv.includes("--apply");

type Row = {
  id: string;
  title: string;
  servings: number;
  tags: string[];
  course: keyof typeof COURSE_LABELS | null;
  main_ingredient: keyof typeof MAIN_INGREDIENT_LABELS | null;
  equipment: Equipment[] | null;
  source_url: string | null;
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
      "id, title, servings, tags, course, main_ingredient, equipment, source_url, recipe_ingredients(name, quantity, unit, position), recipe_steps(text, position)",
    )
    .returns<Row[]>();
  if (error) throw new Error(`No se pudieron leer las recetas: ${error.message}`);

  const { data: allTags } = await supabase.from("recipes").select("tags");
  const existingTags = [...new Set((allTags ?? []).flatMap((row) => row.tags as string[]))];

  console.log(`${apply ? "Escribiendo cambios." : "Simulación: no se escribe nada."}\n`);

  let done = 0;
  for (const recipe of data) {
    const steps = [...recipe.recipe_steps].sort((a, b) => a.position - b.position);
    const fromCookidoo = isCookidooUrl(recipe.source_url);
    const needsCategories = recipe.course === null || recipe.main_ingredient === null;
    // Equipment is read from the steps; a Cookidoo recipe has none and is Thermomix by itself.
    const needsEquipment = (recipe.equipment ?? []).length === 0 && steps.length > 0 && !fromCookidoo;
    if (!needsCategories && !needsEquipment) continue;

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

      // Only fill what is missing; never overwrite something already set.
      const patch = {
        ...(recipe.course === null && { course: estimate.course }),
        ...(recipe.main_ingredient === null && { main_ingredient: estimate.main_ingredient }),
        ...(needsEquipment && estimate.equipment.length > 0 && { equipment: estimate.equipment }),
      };
      const course = COURSE_LABELS[patch.course ?? recipe.course!];
      const main = MAIN_INGREDIENT_LABELS[patch.main_ingredient ?? recipe.main_ingredient!];
      const cooked = (patch.equipment ?? recipe.equipment ?? []).map((item) => EQUIPMENT_LABELS[item]);
      console.log(`- ${recipe.title}: ${course} / ${main}${cooked.length ? ` · ${cooked.join(", ")}` : fromCookidoo ? " · (Cookidoo)" : ""}`);
      if (apply && Object.keys(patch).length) {
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
