import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { contentSignature } from "@/lib/recipes/auto-meta";
import { getRecipe } from "@/lib/recipes/queries";
import { resolveTotalMinutes } from "@/lib/thermomix/cookidoo";
import { getThermomixVersion } from "@/lib/thermomix/queries";
import { ConvertPanel } from "./convert-panel";
import { DeleteVersionButton } from "./delete-version-button";
import { VersionView } from "./version-view";

export const metadata: Metadata = { title: "Thermomix TM7" };

// The conversion server action runs under this page: allow time for the model.
export const maxDuration = 60;

export default async function ThermomixPage({
  params,
}: PageProps<"/recetas/[id]/thermomix">) {
  const { id } = await params;
  const [recipe, version] = await Promise.all([getRecipe(id), getThermomixVersion(id)]);
  const empty = recipe.steps.length === 0;

  // Versions made before the fingerprint existed cannot be compared.
  const legacy = version !== null && version.source_signature === null;
  const outdated =
    version !== null &&
    version.source_signature !== null &&
    version.source_signature !== contentSignature(recipe);

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

      {version && (outdated || legacy) && (
        <p role="status" className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
          {outdated ? (
            <>
              <strong>La receta ha cambiado desde esta conversión.</strong> Esta versión
              Thermomix refleja la receta tal como era. Si quieres que incluya los cambios,
              vuelve a convertirla (más abajo); ojo, se sustituirán también tus ediciones de esta
              versión.
            </>
          ) : (
            <>
              <strong>Versión anterior a los avisos.</strong> No puedo saber si la receta ha
              cambiado desde que se convirtió. Vuelve a convertirla (más abajo) para dejarla al
              día y guardar sus raciones.
            </>
          )}
        </p>
      )}

      {version ? (
        <>
          <VersionView
            recipeId={recipe.id}
            version={{ ...version, servings: version.servings ?? recipe.servings }}
            prepMinutes={recipe.prep_minutes}
            totalMinutes={resolveTotalMinutes(recipe.prep_minutes, recipe.cook_minutes, version.steps)}
          />
          <details open={outdated || legacy} className="rounded-xl border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Volver a convertir con otras raciones
            </summary>
            <div className="mt-3">
              <ConvertPanel recipeId={recipe.id} defaultServings={recipe.servings} replacing />
            </div>
          </details>
          <DeleteVersionButton recipeId={recipe.id} />
        </>
      ) : empty ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          La receta no tiene pasos, así que no hay nada que convertir. Si es de Cookidoo, los pasos están allí.
        </p>
      ) : (
        <ConvertPanel recipeId={recipe.id} defaultServings={recipe.servings} replacing={false} />
      )}
    </div>
  );
}
