"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link2, Loader2, Search, Sparkles, Trash2, X } from "lucide-react";
import { MainIngredientBadge } from "@/components/main-ingredient-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMinutes } from "@/lib/recipes/format";
import { COURSE_LABELS, MAIN_INGREDIENT_LABELS } from "@/lib/recipes/constants";
import { extractCookidooUrl, isCookidooUrl } from "@/lib/recipes/cookidoo-url";
import { parseQuery, searchScore } from "@/lib/recipes/search";
import type { RecipeOption } from "@/lib/menu/queries";
import { cn } from "@/lib/utils";

export function SlotPicker({
  title,
  recipes,
  currentRecipeId,
  usedIds,
  pending,
  onSelect,
  onRegenerate,
  onAddCookidoo,
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
  /** Imports a Cookidoo recipe from its link and puts it in this slot. */
  onAddCookidoo: (url: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [cookidooUrl, setCookidooUrl] = useState("");
  // Which action is running, to label the right button while `pending` is shared.
  const [busy, setBusy] = useState<"ai" | "cookidoo" | null>(null);

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
        <h2 className="font-heading font-semibold capitalize">{title}</h2>
        <Button type="button" variant="ghost" size="icon" onClick={() => dialog.current?.close()} aria-label="Cerrar">
          <X />
        </Button>
      </div>

      <div className="flex flex-col gap-3 p-4 pb-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setBusy("ai");
            onRegenerate();
          }}
          disabled={pending}
        >
          {pending && busy === "ai" ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {pending && busy === "ai" ? "Pensando… (hasta un minuto)" : "Sugerir con IA"}
        </Button>

        <form
          className="flex flex-col gap-1.5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!cookidooUrl.trim()) return;
            setBusy("cookidoo");
            onAddCookidoo(extractCookidooUrl(cookidooUrl));
          }}
        >
          <label htmlFor="cookidoo-url" className="text-sm font-medium">
            ¿Receta de Cookidoo?
          </label>
          <div className="flex gap-2">
            <Input
              id="cookidoo-url"
              // Not type="url": what Cookidoo copies is a sentence with the link in it.
              type="text"
              inputMode="url"
              autoComplete="off"
              value={cookidooUrl}
              onChange={(e) => setCookidooUrl(e.target.value)}
              onPaste={(e) => {
                // Pasting the whole shared text leaves just the link in the field.
                const text = e.clipboardData.getData("text");
                const url = extractCookidooUrl(text);
                if (url !== text.trim() && isCookidooUrl(url)) {
                  e.preventDefault();
                  setCookidooUrl(url);
                }
              }}
              placeholder="Pega aquí el enlace (o el texto que copia Cookidoo)"
              disabled={pending}
            />
            <Button type="submit" variant="outline" disabled={pending || !cookidooUrl.trim()}>
              {pending && busy === "cookidoo" ? <Loader2 className="animate-spin" /> : <Link2 />}
              {pending && busy === "cookidoo" ? "Importando…" : "Añadir"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Se guarda en tu recetario (con ingredientes, sin pasos: los tienes en Cookidoo) y queda
            puesta en este hueco.
          </p>
        </form>
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
