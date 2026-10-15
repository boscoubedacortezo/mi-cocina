import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChefHat, Clock, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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

export const metadata: Metadata = { title: "Recetas" };

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

type Filters = { q?: string; tag?: string; tipo?: Course; principal?: MainIngredient };

function href(filters: Filters) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) next.set(key, value);
  const qs = next.toString();
  return qs ? `/recetas?${qs}` : "/recetas";
}

/** A horizontally scrollable row of filter chips with an "all" option. */
function FilterRow({
  label,
  allHref,
  active,
  options,
}: {
  label: string;
  allHref: string;
  active: string | undefined;
  options: { value: string; label: string; href: string }[];
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href={allHref} aria-current={!active ? "true" : undefined}>
          <Badge variant={!active ? "default" : "outline"}>Todas</Badge>
        </Link>
        {options.map((option) => (
          <Link
            key={option.value}
            href={option.href}
            aria-current={active === option.value ? "true" : undefined}
            className="shrink-0"
          >
            <Badge variant={active === option.value ? "default" : "outline"}>{option.label}</Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function RecipesPage({ searchParams }: PageProps<"/recetas">) {
  const params = await searchParams;
  const q = first(params.q);
  const tag = first(params.tag);
  // Unknown values in the URL are ignored instead of producing an empty list.
  const tipo = COURSES.find((value) => value === first(params.tipo));
  const principal = MAIN_INGREDIENTS.find((value) => value === first(params.principal));
  const current: Filters = { q, tag, tipo, principal };

  const [recipes, facets] = await Promise.all([
    listRecipes({ q, tag, course: tipo, main: principal }),
    listFacets(),
  ]);
  const filtering = Boolean(q || tag || tipo || principal);

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
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      <FilterRow
        label="Tipo de plato"
        allHref={href({ ...current, tipo: undefined })}
        active={tipo}
        options={COURSES.filter((value) => facets.courses.has(value)).map((value) => ({
          value,
          label: COURSE_LABELS[value],
          href: href({ ...current, tipo: value }),
        }))}
      />
      <FilterRow
        label="Ingrediente principal"
        allHref={href({ ...current, principal: undefined })}
        active={principal}
        options={MAIN_INGREDIENTS.filter((value) => facets.mains.has(value)).map((value) => ({
          value,
          label: MAIN_INGREDIENT_LABELS[value],
          href: href({ ...current, principal: value }),
        }))}
      />
      <FilterRow
        label="Etiquetas"
        allHref={href({ ...current, tag: undefined })}
        active={tag}
        options={facets.tags.map((value) => ({
          value,
          label: value,
          href: href({ ...current, tag: value }),
        }))}
      />

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
                  <div className="relative">
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
                    {recipe.has_thermomix && (
                      <span
                        className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm"
                        title="Tiene versión Thermomix"
                      >
                        <ChefHat className="size-3.5" aria-hidden />
                        Thermomix
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 p-3">
                    <h2 className="font-heading leading-snug font-medium">
                      {recipe.title}
                    </h2>
                    {total && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3.5" aria-hidden />
                        {total}
                      </p>
                    )}
                    {(recipe.course || recipe.main_ingredient || recipe.tags.length > 0) && (
                      <div className="flex flex-wrap gap-1">
                        {recipe.course && <Badge>{COURSE_LABELS[recipe.course]}</Badge>}
                        {recipe.main_ingredient && (
                          <Badge variant="outline">{MAIN_INGREDIENT_LABELS[recipe.main_ingredient]}</Badge>
                        )}
                        {recipe.tags.map((t) => (
                          <Badge key={t} variant="secondary">
                            {t}
                          </Badge>
                        ))}
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
