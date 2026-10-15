import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChefHat, Clock, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { RecipePlaceholder } from "@/components/recipe-placeholder";
import { Input } from "@/components/ui/input";
import { formatMinutes } from "@/lib/recipes/format";
import {
  COURSES,
  COURSE_LABELS,
  MAIN_INGREDIENTS,
  MAIN_INGREDIENT_LABELS,
  type Course,
  type MainIngredient,
} from "@/lib/recipes/constants";
import { listFacets, listRecipes } from "@/lib/recipes/queries";
import { FiltersButton } from "./filters-sheet";

export const metadata: Metadata = { title: "Recetas" };

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

type Filters = {
  q?: string;
  tag?: string;
  tipo?: Course;
  principal?: MainIngredient;
  thermomix?: "1";
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
  const thermomix = first(params.thermomix) === "1" ? "1" : undefined;
  const current: Filters = { q, tag, tipo, principal, thermomix };

  const [recipes, facets] = await Promise.all([
    listRecipes({ q, tag, course: tipo, main: principal, thermomix: Boolean(thermomix) }),
    listFacets(),
  ]);
  const filtering = Boolean(q || tag || tipo || principal || thermomix);

  // What is applied right now, each with the link that removes just that filter.
  const active = [
    tipo && { label: COURSE_LABELS[tipo], href: href({ ...current, tipo: undefined }) },
    principal && {
      label: MAIN_INGREDIENT_LABELS[principal],
      href: href({ ...current, principal: undefined }),
    },
    thermomix && { label: "Con Thermomix", href: href({ ...current, thermomix: undefined }) },
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
        {thermomix && <input type="hidden" name="thermomix" value={thermomix} />}
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Buscar receta"
            aria-label="Buscar receta"
            className="pl-8"
          />
        </div>
        <FiltersButton
          q={q}
          current={{ tipo, principal, tag, thermomix }}
          courses={COURSES.filter((value) => facets.courses.has(value)).map((value) => ({
            value,
            label: COURSE_LABELS[value],
          }))}
          mains={MAIN_INGREDIENTS.filter((value) => facets.mains.has(value)).map((value) => ({
            value,
            label: MAIN_INGREDIENT_LABELS[value],
          }))}
          tags={facets.tags}
          hasThermomix={facets.hasThermomix}
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
          {recipes.map((recipe) => {
            const total = formatMinutes(
              (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0),
            );
            return (
              <li key={recipe.id}>
                <Link
                  href={`/recetas/${recipe.id}`}
                  className="flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:bg-accent/40"
                >
                  {recipe.image_url ? (
                    <div className="relative aspect-[16/9] bg-muted">
                      <Image
                        src={recipe.image_url}
                        alt=""
                        fill
                        sizes="(min-width: 672px) 336px, 100vw"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <RecipePlaceholder recipe={recipe} className="aspect-[16/9]" />
                  )}
                  <div className="flex flex-col gap-2 p-3">
                    <h2 className="font-heading leading-snug font-medium">
                      {recipe.title}
                    </h2>
                    {(total || recipe.has_thermomix) && (
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {total && (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5" aria-hidden />
                            {total}
                          </span>
                        )}
                        {recipe.has_thermomix && (
                          <span
                            className="flex items-center gap-1 font-medium text-foreground"
                            title="Tiene versión Thermomix"
                          >
                            <ChefHat className="size-3.5" aria-hidden />
                            Thermomix
                          </span>
                        )}
                      </p>
                    )}
                    {(recipe.course || recipe.main_ingredient) && (
                      <div className="flex flex-wrap gap-1">
                        {recipe.course && <Badge>{COURSE_LABELS[recipe.course]}</Badge>}
                        {recipe.main_ingredient && (
                          <Badge variant="outline">{MAIN_INGREDIENT_LABELS[recipe.main_ingredient]}</Badge>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
