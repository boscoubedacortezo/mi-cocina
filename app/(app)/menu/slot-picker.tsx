"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, Search, Sparkles, Trash2, WandSparkles, X } from "lucide-react";
import { MainIngredientBadge } from "@/components/main-ingredient-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMinutes } from "@/lib/recipes/format";
import { COURSE_LABELS, MAIN_INGREDIENT_LABELS } from "@/lib/recipes/constants";
import { parseQuery, searchScore } from "@/lib/recipes/search";
import type { RecipeOption } from "@/lib/menu/queries";
import { cn } from "@/lib/utils";

const tile =
  "flex flex-col items-center justify-center gap-1 rounded-xl border bg-background py-2.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50";

export function SlotPicker({
  title,
  recipes,
  currentRecipeId,
  usedIds,
  pending,
  onSelect,
  onRegenerate,
  onAway,
  createHref,
  onClear,
  onClose,
}: {
  title: string;
  recipes: RecipeOption[];
  currentRecipeId: string | null;
  /** Recipes already in this week's menu. */
  usedIds: Set<string>;
  pending: boolean;
  onSelect: (recipeId: string) => void;
  onRegenerate: () => void;
  /** Marks this slot "fuera de casa": no recipe, nothing generated. */
  onAway: () => void;
  /** Where to create a new recipe that will land in this slot. */
  createHref: string;
  onClear: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  // Whether the AI is the action running, to label its button while `pending` is shared.
  const [busy, setBusy] = useState<"ai" | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  // Same search as the recipe list: every word, no accents, ingredients included, best first.
  const filtered = useMemo(() => {
    const tokens = parseQuery(query);
    if (tokens.length === 0) return recipes;
    return recipes
      .map((recipe, index) => ({
        recipe,
        index,
        score: searchScore(
          {
            title: recipe.title,
            tags: recipe.tags,
            labels: [
              ...(recipe.course ? [COURSE_LABELS[recipe.course]] : []),
              ...(recipe.main_ingredient ? [MAIN_INGREDIENT_LABELS[recipe.main_ingredient]] : []),
            ],
            ingredients: recipe.ingredients,
          },
          tokens,
        ),
      }))
      .filter((item): item is { recipe: RecipeOption; index: number; score: number } => item.score !== null)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => item.recipe);
  }, [recipes, query]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current?.close();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[85dvh] w-full max-w-2xl flex-col rounded-t-2xl border bg-background p-0 text-foreground backdrop:bg-black/50 open:flex"
    >
      <div className="flex items-center justify-between gap-2 border-b p-4">
        <h2 className="font-heading font-semibold">{title}</h2>
        <Button type="button" variant="ghost" size="icon" onClick={() => dialog.current?.close()} aria-label="Cerrar">
          <X />
        </Button>
      </div>

      <div className="flex flex-col gap-3 p-4 pb-2">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setBusy("ai");
              onRegenerate();
            }}
            disabled={pending}
            title="Sugerir una receta de las tuyas con IA"
            aria-label="Sugerir con IA"
            className={tile}
          >
            {pending && busy === "ai" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Sparkles className="size-5" />
            )}
            {pending && busy === "ai" ? "Pensando…" : "Sugerir"}
          </button>
          <Link
            href={createHref}
            title="Crear una receta nueva con IA"
            aria-label="Crear una receta nueva con IA"
            className={tile}
          >
            <WandSparkles className="size-5" aria-hidden />
            Crear
          </Link>
          <button
            type="button"
            onClick={onAway}
            disabled={pending}
            title="Fuera de casa"
            aria-label="Fuera de casa"
            className={tile}
          >
            <MapPin className="size-5" aria-hidden />
            Fuera
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          ¿Una receta de Cookidoo que aún no tienes?{" "}
          <Link href="/recetas/nueva" className="underline underline-offset-4">
            Impórtala en Recetas
          </Link>{" "}
          (Nueva → URL) y vuelve aquí.
        </p>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar receta"
            aria-label="Buscar receta"
            className="pl-8"
          />
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto px-4 pb-2">
        {filtered.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">
            {recipes.length === 0 ? "Todavía no tienes recetas." : "Ninguna receta coincide."}
          </li>
        )}
        {filtered.map((recipe) => {
          const time = formatMinutes(recipe.minutes);
          return (
            <li key={recipe.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onSelect(recipe.id)}
                className={cn(
                  "flex w-full flex-col items-start gap-1 border-b py-3 text-left disabled:opacity-60",
                  recipe.id === currentRecipeId && "font-medium",
                )}
              >
                <span>{recipe.title}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {time && <span>{time}</span>}
                  {recipe.course && <Badge>{COURSE_LABELS[recipe.course]}</Badge>}
                  {recipe.main_ingredient && (
                    <MainIngredientBadge value={recipe.main_ingredient} />
                  )}
                  {recipe.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                  {recipe.id === currentRecipeId ? (
                    <Badge>En este hueco</Badge>
                  ) : (
                    usedIds.has(recipe.id) && <Badge variant="outline">Ya en el menú</Badge>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {currentRecipeId && (
        <div className="border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button type="button" variant="outline" className="w-full text-destructive" onClick={onClear} disabled={pending}>
            <Trash2 /> Quitar receta del hueco
          </Button>
        </div>
      )}
    </dialog>
  );
}
