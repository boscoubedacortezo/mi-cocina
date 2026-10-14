"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, Sparkles, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMinutes } from "@/lib/recipes/format";
import type { RecipeOption } from "@/lib/menu/queries";
import { cn } from "@/lib/utils";

const normalize = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function SlotPicker({
  title,
  recipes,
  currentRecipeId,
  usedIds,
  pending,
  onSelect,
  onRegenerate,
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
  onClear: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return recipes;
    return recipes.filter((r) => normalize(`${r.title} ${r.tags.join(" ")}`).includes(q));
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
        <Button type="button" variant="outline" onClick={onRegenerate} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {pending ? "Pensando… (hasta un minuto)" : "Sugerir con IA"}
        </Button>
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
                  {recipe.tags.slice(0, 3).map((tag) => (
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
