import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { buildCookidooRecipe } from "@/lib/cookidoo/payload";
import { serializeRecipe } from "@/lib/cookidoo/runner";
import { socialPlatform } from "@/lib/recipes/social-url";
import { contentSignature } from "@/lib/recipes/auto-meta";
import { getRecipe } from "@/lib/recipes/queries";
import { resolveTotalMinutes } from "@/lib/thermomix/cookidoo";
import { TM_BOWL_ML } from "@/lib/thermomix/constants";
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
  // The version keeps the servings that were asked for; if the bowl cannot hold them, say so.
  const overflow = version?.capacity && version.capacity.peak_ml > TM_BOWL_ML ? version.capacity : null;

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

      {overflow && version && (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
          <p>
            <strong>Esta receta no cabe en el vaso con {version.servings ?? recipe.servings} raciones.</strong>{" "}
            En el paso {overflow.step} llegaría a unos {(overflow.peak_ml / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} L y el máximo es{" "}
            {(TM_BOWL_ML / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} L.{" "}
            {overflow.fitting_servings
              ? `Con unas ${overflow.fitting_servings} raciones sí cabría: puedes volver a convertirla más abajo. `
              : "Reduce las raciones y vuelve a convertirla más abajo. "}
            La receta está como la pediste: no he tocado las cantidades.
          </p>
        </div>
      )}

      {version ? (
        <>
          <VersionView
            recipeId={recipe.id}
            version={{ ...version, servings: version.servings ?? recipe.servings }}
            prepMinutes={recipe.prep_minutes}
            totalMinutes={resolveTotalMinutes(recipe.prep_minutes, recipe.cook_minutes, version.steps)}
            hasPhoto={Boolean(recipe.image_path)}
            photoOwned={!socialPlatform(recipe.source_url)}
            cookidooPayload={serializeRecipe(
              buildCookidooRecipe({
                title: recipe.title,
                servings: version.servings ?? recipe.servings,
                prepMinutes: recipe.prep_minutes,
                totalMinutes: resolveTotalMinutes(recipe.prep_minutes, recipe.cook_minutes, version.steps),
                ingredientsText: version.ingredients_text,
                steps: version.steps,
              }),
            )}
          />
          <details open={outdated || legacy || Boolean(overflow)} className="rounded-xl border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Volver a convertir con otras raciones
            </summary>
            <div className="mt-3">
              <ConvertPanel
                recipeId={recipe.id}
                defaultServings={overflow?.fitting_servings ?? recipe.servings}
                replacing
              />
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
