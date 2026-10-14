import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getRecipe } from "@/lib/recipes/queries";
import { getThermomixVersion } from "@/lib/thermomix/queries";
import { ConvertPanel } from "./convert-panel";
import { VersionView } from "./version-view";

export const metadata: Metadata = { title: "Thermomix TM7" };

// The conversion server action runs under this page: allow time for the model.
export const maxDuration = 60;

export default async function ThermomixPage({
  params,
}: PageProps<"/recetas/[id]/thermomix">) {
  const { id } = await params;
  const [recipe, version] = await Promise.all([getRecipe(id), getThermomixVersion(id)]);
  const empty = recipe.ingredients.length === 0 && recipe.steps.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/recetas/${recipe.id}`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> {recipe.title}
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Thermomix TM7</h1>
        <p className="text-muted-foreground">
          Versión adaptada de «{recipe.title}» lista para pegar en Cookidoo («Creadas por mí»).
        </p>
      </header>

      {version ? (
        <>
          <VersionView recipeId={recipe.id} version={version} />
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Volver a convertir con otras raciones
            </summary>
            <div className="mt-3">
              <ConvertPanel recipeId={recipe.id} defaultServings={recipe.servings} replacing />
            </div>
          </details>
        </>
      ) : empty ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          La receta no tiene ingredientes ni pasos. Edítala antes de convertirla.
        </p>
      ) : (
        <ConvertPanel recipeId={recipe.id} defaultServings={recipe.servings} replacing={false} />
      )}
    </div>
  );
}
