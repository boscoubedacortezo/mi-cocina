"use client";

import { useState } from "react";
import { Minus, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Unit } from "@/lib/recipes/constants";
import { formatScaledIngredient } from "@/lib/recipes/scale";

type Ingredient = {
  id: string;
  name: string;
  quantity: number | null;
  unit: Unit | null;
  optional: boolean;
};

const MAX_SERVINGS = 100;

/** Ingredient list whose quantities follow the number of servings you want. */
export function ScalableIngredients({
  baseServings,
  ingredients,
}: {
  baseServings: number;
  ingredients: Ingredient[];
}) {
  const [servings, setServings] = useState(baseServings);
  const factor = servings / baseServings;
  const changed = servings !== baseServings;

  if (ingredients.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin ingredientes.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden /> Raciones
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={servings <= 1}
            onClick={() => setServings(servings - 1)}
            aria-label="Una ración menos"
          >
            <Minus />
          </Button>
          <span className="w-10 text-center text-lg font-medium" aria-live="polite">
            {servings}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={servings >= MAX_SERVINGS}
            onClick={() => setServings(servings + 1)}
            aria-label="Una ración más"
          >
            <Plus />
          </Button>
        </div>
      </div>

      {changed && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span>
            Cantidades ajustadas (la receta es para {baseServings}). Los pasos y los tiempos no
            se modifican.
          </span>
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => setServings(baseServings)}
          >
            Restablecer
          </button>
        </p>
      )}

      <ul className="flex flex-col divide-y rounded-xl border">
        {ingredients.map((item) => (
          <li key={item.id} className="px-3 py-2">
            {formatScaledIngredient(item, factor)}
            {item.optional && <span className="text-sm text-muted-foreground"> (opcional)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
