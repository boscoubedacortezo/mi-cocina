import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Clock, Plus, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { RecipePlaceholder } from "@/components/recipe-placeholder";
import { Input } from "@/components/ui/input";
import { formatMinutes } from "@/lib/recipes/format";
import { listAllTags, listRecipes } from "@/lib/recipes/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Recetas" };

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

export default async function RecipesPage({ searchParams }: PageProps<"/recetas">) {
  const params = await searchParams;
  const q = first(params.q);
  const tag = first(params.tag);

  const [recipes, tags] = await Promise.all([
    listRecipes({ q, tag }),
    listAllTags(),
  ]);
  const filtering = Boolean(q || tag);

  const tagHref = (value: string | undefined) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (value) next.set("tag", value);
    const qs = next.toString();
    return qs ? `/recetas?${qs}` : "/recetas";
  };

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

      {tags.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Link href={tagHref(undefined)} aria-current={!tag ? "true" : undefined}>
            <Badge variant={!tag ? "default" : "outline"}>Todas</Badge>
          </Link>
          {tags.map((t) => (
            <Link key={t} href={tagHref(t)} aria-current={tag === t ? "true" : undefined}>
              <Badge variant={tag === t ? "default" : "outline"}>{t}</Badge>
            </Link>
          ))}
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
                    <p
                      className={cn(
                        "flex items-center gap-3 text-xs text-muted-foreground",
                      )}
                    >
                      <span className="flex items-center gap-1">
                        <Users className="size-3.5" aria-hidden />
                        {recipe.servings}
                      </span>
                      {total && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" aria-hidden />
                          {total}
                        </span>
                      )}
                    </p>
                    {recipe.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
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
