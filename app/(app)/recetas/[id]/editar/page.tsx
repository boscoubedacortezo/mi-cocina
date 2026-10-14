import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-server";
import { getRecipe } from "@/lib/recipes/queries";
import { RecipeForm } from "../../_components/recipe-form";

export const metadata: Metadata = { title: "Editar receta" };

export default async function EditRecipePage({
  params,
}: PageProps<"/recetas/[id]/editar">) {
  const { id } = await params;
  const [{ userId }, recipe] = await Promise.all([requireUser(), getRecipe(id)]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-semibold">Editar receta</h1>
      <RecipeForm
        userId={userId}
        recipeId={recipe.id}
        sourceType={recipe.source_type}
        initial={recipe}
      />
    </div>
  );
}
