import type { Metadata } from "next";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { RecipeCard } from "@/components/recipe-card";
import {
  COURSES,
  COURSE_LABELS,
  EQUIPMENT,
  EQUIPMENT_LABELS,
  MAIN_INGREDIENTS,
  MAIN_INGREDIENT_LABELS,
  THERMOMIX_FILTER,
  type Course,
  type Equipment,
  type MainIngredient,
} from "@/lib/recipes/constants";
import { ORIGINS, ORIGIN_LABELS, type Origin } from "@/lib/recipes/origin";
import { listFacets, listRecipes } from "@/lib/recipes/queries";
import { FiltersButton } from "./filters-sheet";
import { SearchInput } from "./search-input";

export const metadata: Metadata = { title: "Recetas" };

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

type Filters = {
  q?: string;
  tag?: string;
  tipo?: Course;
  principal?: MainIngredient;
  /** How it is cooked: "thermomix" or one of the other ways. */
  cocina?: typeof THERMOMIX_FILTER | Equipment;
  /** Where it comes from. */
  origen?: Origin;
};

function href(filters: Filters) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) next.set(key, value);
  const qs = next.toString();
  return qs ? `/recetas?${qs}` : "/recetas";
}

export default async function RecipesPage({ searchParams }: PageProps<"/recetas">) {
  const params = await searchParams;
  const q = first(params.q);
  const tag = first(params.tag);
  // Unknown values in the URL are ignored instead of producing an empty list.
  const tipo = COURSES.find((value) => value === first(params.tipo));
  const principal = MAIN_INGREDIENTS.find((value) => value === first(params.principal));
  const cocinaParam = first(params.cocina);
  const cocina =
    cocinaParam === THERMOMIX_FILTER ? THERMOMIX_FILTER : EQUIPMENT.find((value) => value === cocinaParam);
  const origen = ORIGINS.find((value) => value === first(params.origen));
  const current: Filters = { q, tag, tipo, principal, cocina, origen };

  const [recipes, facets] = await Promise.all([
    listRecipes({ q, tag, course: tipo, main: principal, cocina, origen }),
    listFacets(),
  ]);
  const filtering = Boolean(q || tag || tipo || principal || cocina || origen);

  // What is applied right now, each with the link that removes just that filter.
  const active = [
    tipo && { label: COURSE_LABELS[tipo], href: href({ ...current, tipo: undefined }) },
    principal && {
      label: MAIN_INGREDIENT_LABELS[principal],
      href: href({ ...current, principal: undefined }),
    },
    cocina && {
      label: cocina === THERMOMIX_FILTER ? "Thermomix" : EQUIPMENT_LABELS[cocina],
      href: href({ ...current, cocina: undefined }),
    },
    origen && { label: ORIGIN_LABELS[origen], href: href({ ...current, origen: undefined }) },
    tag && { label: tag, href: href({ ...current, tag: undefined }) },
  ].filter((filter): filter is { label: string; href: string } => Boolean(filter));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Recetas</h1>
        <Link href="/recetas/nueva" className={buttonVariants({ size: "sm" })}>
          <Plus /> Nueva
        </Link>
      </div>

      <form action="/recetas" className="flex gap-2" role="search">
        {tag && <input type="hidden" name="tag" value={tag} />}
        {tipo && <input type="hidden" name="tipo" value={tipo} />}
        {principal && <input type="hidden" name="principal" value={principal} />}
        {cocina && <input type="hidden" name="cocina" value={cocina} />}
        {origen && <input type="hidden" name="origen" value={origen} />}
        <SearchInput defaultValue={q} clearHref={href({ ...current, q: undefined })} />
        <FiltersButton
          q={q}
          current={{ tipo, principal, tag, cocina, origen }}
          courses={COURSES.filter((value) => facets.courses.has(value)).map((value) => ({
            value,
            label: COURSE_LABELS[value],
          }))}
          mains={MAIN_INGREDIENTS.filter((value) => facets.mains.has(value)).map((value) => ({
            value,
            label: MAIN_INGREDIENT_LABELS[value],
          }))}
          tags={facets.tags}
          cooking={[
            ...(facets.hasThermomix ? [{ value: THERMOMIX_FILTER, label: "Thermomix" }] : []),
            ...EQUIPMENT.filter((value) => facets.equipment.has(value)).map((value) => ({
              value,
              label: EQUIPMENT_LABELS[value],
            })),
          ]}
          origins={ORIGINS.filter((value) => facets.origins.has(value)).map((value) => ({
            value,
            label: ORIGIN_LABELS[value],
          }))}
        />
      </form>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {active.map((filter) => (
            <Link key={filter.label} href={filter.href} aria-label={`Quitar filtro ${filter.label}`}>
              <Badge variant="secondary" className="gap-1 px-2.5 py-1 text-sm">
                {filter.label}
                <X className="size-3.5" aria-hidden />
              </Badge>
            </Link>
          ))}
          {active.length > 1 && (
            <Link
              href={href({ q })}
              className="text-sm text-muted-foreground underline underline-offset-4"
            >
              Quitar todos
            </Link>
          )}
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            {filtering
              ? "No hay recetas que coincidan con la búsqueda."
              : "Todavía no tienes recetas."}
          </p>
          {filtering ? (
            <Link href="/recetas" className={buttonVariants({ variant: "outline" })}>
              Quitar filtros
            </Link>
          ) : (
            <Link href="/recetas/nueva" className={buttonVariants()}>
              Crear la primera receta
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <RecipeCard recipe={recipe} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
