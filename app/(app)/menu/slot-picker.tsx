"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link2, Loader2, Search, Sparkles, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMinutes } from "@/lib/recipes/format";
import { COURSE_LABELS, MAIN_INGREDIENT_LABELS } from "@/lib/recipes/constants";
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

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return recipes;
    return recipes.filter((r) => normalize(
          `${r.title} ${r.tags.join(" ")} ${r.course ? COURSE_LABELS[r.course] : ""} ${r.main_ingredient ? MAIN_INGREDIENT_LABELS[r.main_ingredient] : ""}`,
        ).includes(q));
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
          onSubmit={(e) => {
            e.preventDefault();
            if (!cookidooUrl.trim()) return;
            setBusy("cookidoo");
            onAddCookidoo(cookidooUrl.trim());
          }}
        >
          <label htmlFor="cookidoo-url" className="text-sm font-medium">
            ¿Receta de Cookidoo?
          </label>
          <div className="flex gap-2">
            <Input
              id="cookidoo-url"
              type="url"
              inputMode="url"
              value={cookidooUrl}
              onChange={(e) => setCookidooUrl(e.target.value)}
              placeholder="Pega aquí el enlace"
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
                    <Badge variant="outline">{MAIN_INGREDIENT_LABELS[recipe.main_ingredient]}</Badge>
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
