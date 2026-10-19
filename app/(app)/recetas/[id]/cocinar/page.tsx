import type { Metadata } from "next";
import { formatIngredient } from "@/lib/recipes/format";
import { getRecipe } from "@/lib/recipes/queries";
import { stepSettings } from "@/lib/thermomix/cookidoo";
import { getThermomixVersion } from "@/lib/thermomix/queries";
import { CookMode } from "./cook-mode";

export const metadata: Metadata = { title: "Cocinar" };

export default async function CookPage({ params }: PageProps<"/recetas/[id]/cocinar">) {
  const { id } = await params;
  const [recipe, version] = await Promise.all([getRecipe(id), getThermomixVersion(id)]);

  const original = {
    ingredients: recipe.ingredients.map((item) => formatIngredient(item)),
    steps: recipe.steps.map((step) => ({ text: step.text, settings: [] as string[] })),
  };
  const thermomix = version
    ? {
        ingredients: version.ingredients_text
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        steps: version.steps.map((step) => ({ text: step.text, settings: stepSettings(step) })),
      }
    : null;

  return <CookMode recipeId={recipe.id} title={recipe.title} original={original} thermomix={thermomix} />;
}
