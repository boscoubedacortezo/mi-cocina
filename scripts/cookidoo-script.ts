/**
 * Prints the script that sends one recipe's Thermomix version to Cookidoo. Paste it in
 * the browser console on cookidoo.es (logged in). Needs a Thermomix version.
 *
 *   npx tsx --conditions react-server --env-file=.env.local scripts/cookidoo-script.ts            # lists recipes
 *   npx tsx --conditions react-server --env-file=.env.local scripts/cookidoo-script.ts <id> | pbcopy
 *
 * Uses the service-role key (bypasses RLS): run it on your own machine only.
 */
import { createClient } from "@supabase/supabase-js";
import { buildCookidooRecipe } from "@/lib/cookidoo/payload";
import { buildRunnerScript } from "@/lib/cookidoo/runner";
import { resolveTotalMinutes } from "@/lib/thermomix/cookidoo";
import { thermomixStepSchema } from "@/lib/thermomix/schema";
import { z } from "zod";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const id = process.argv[2];

  if (!id) {
    const { data } = await supabase
      .from("recipes")
      .select("id, title, thermomix_versions(id)")
      .order("title");
    for (const row of data ?? []) {
      const has = (row.thermomix_versions as unknown[]).length > 0;
      console.error(`${has ? "TM7" : "   "}  ${row.id}  ${row.title}`);
    }
    return;
  }

  const { data: recipe, error } = await supabase
    .from("recipes")
    .select("id, title, servings, prep_minutes, cook_minutes")
    .eq("id", id)
    .single();
  if (error || !recipe) throw new Error("No encuentro esa receta.");

  const { data: version } = await supabase
    .from("thermomix_versions")
    .select("servings, ingredients_text, steps")
    .eq("recipe_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!version) throw new Error("Esa receta no tiene versión Thermomix.");

  const steps = z.array(thermomixStepSchema).parse(version.steps);
  const payload = buildCookidooRecipe({
    title: recipe.title,
    servings: version.servings ?? recipe.servings,
    prepMinutes: recipe.prep_minutes,
    totalMinutes: resolveTotalMinutes(recipe.prep_minutes, recipe.cook_minutes, steps),
    ingredientsText: version.ingredients_text,
    steps,
  });
  process.stdout.write(buildRunnerScript(payload));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
