"use client";

import { useState, useTransition } from "react";
import { Loader2, Minus, Plus, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Unit } from "@/lib/recipes/constants";
import { formatMinutes } from "@/lib/recipes/format";
import { formatScaledIngredient } from "@/lib/recipes/scale";
import { scaleStepText } from "@/lib/recipes/scale-text";
import { adaptRecipeToServings } from "./adapt-actions";

type Ingredient = {
  id: string;
  name: string;
  quantity: number | null;
  unit: Unit | null;
  optional: boolean;
};

type Adaptation = {
  servings: number;
  steps: string[];
  tips: string[];
  prep_minutes: number | null;
  cook_minutes: number | null;
};

const MAX_SERVINGS = 100;

function StepList({ children }: { children: React.ReactNode[] }) {
  return <ol className="flex flex-col gap-3">{children}</ol>;
}

function Step({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
        {index + 1}
      </span>
      <p className="whitespace-pre-line">{children}</p>
    </li>
  );
}

/**
 * Ingredients and steps that follow the servings you want. Quantities are scaled
 * exactly; for big changes the AI can also rewrite steps and times (never saved).
 */
export function ScalableRecipe({
  recipeId,
  baseServings,
  ingredients,
  steps,
  stepsNote,
}: {
  recipeId: string;
  baseServings: number;
  ingredients: Ingredient[];
  steps: { id: string; text: string }[];
  /** Shown instead of "Sin pasos" when the recipe has none on purpose. */
  stepsNote?: string;
}) {
  const [servings, setServings] = useState(baseServings);
  const [adaptation, setAdaptation] = useState<Adaptation | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [pending, startTransition] = useTransition();

  const factor = servings / baseServings;
  const changed = servings !== baseServings;
  // Times and technique change a lot with big jumps: 1.5x or more, or a third less.
  const bigChange = factor >= 1.5 || factor <= 2 / 3;
  const adapted = adaptation && adaptation.servings === servings ? adaptation : null;
  const showAdapted = adapted !== null && !showOriginal;

  function adapt() {
    startTransition(async () => {
      const result = await adaptRecipeToServings({ recipeId, servings });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAdaptation({ servings, ...result });
      setShowOriginal(false);
    });
  }

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Ingredientes</h2>
        {ingredients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ingredientes.</p>
        ) : (
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

            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span>
                {changed ? "Cantidades ajustadas. " : ""}La receta original es para {baseServings}{" "}
                {baseServings === 1 ? "ración" : "raciones"}.
              </span>
              {changed && (
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={() => setServings(baseServings)}
                >
                  Restablecer
                </button>
              )}
            </p>

            <ul className="flex flex-col divide-y rounded-xl border">
              {ingredients.map((item) => (
                <li key={item.id} className="px-3 py-2">
                  {formatScaledIngredient(item, factor)}
                  {item.optional && (
                    <span className="text-sm text-muted-foreground"> (opcional)</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Preparación</h2>
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{stepsNote ?? "Sin pasos."}</p>
        ) : (
          <>
            {changed && bigChange && (
              <div className="flex flex-col gap-2 rounded-xl border border-dashed p-3">
                {adapted && showAdapted ? (
                  <>
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <Sparkles className="size-4" aria-hidden /> Adaptado con IA a {servings} raciones
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Es una sugerencia: revisa tiempos y cantidades antes de cocinar. No se guarda.
                    </p>
                    {(adapted.prep_minutes || adapted.cook_minutes) && (
                      <p className="text-sm">
                        {[
                          adapted.prep_minutes && `Preparación ${formatMinutes(adapted.prep_minutes)}`,
                          adapted.cook_minutes && `Cocción ${formatMinutes(adapted.cook_minutes)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {adapted.tips.length > 0 && (
                      <ul className="list-disc pl-5 text-sm">
                        {adapted.tips.map((tip) => (
                          <li key={tip}>{tip}</li>
                        ))}
                      </ul>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowOriginal(true)}>
                      Ver los pasos originales
                    </Button>
                  </>
                ) : adapted ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowOriginal(false)}>
                    <Sparkles /> Ver la adaptación con IA
                  </Button>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Con este cambio de raciones, los tiempos y la técnica (recipiente, tandas) pueden
                      variar.
                    </p>
                    <Button type="button" variant="outline" onClick={adapt} disabled={pending}>
                      {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                      {pending ? "Adaptando… (unos 10 segundos)" : "Adaptar pasos y tiempos con IA"}
                    </Button>
                  </>
                )}
              </div>
            )}

            {changed && !showAdapted && (
              <p className="text-sm text-muted-foreground">
                Las cantidades que se nombran en los pasos se han ajustado
                {" "}(<strong className="font-semibold">en negrita</strong>). Los tiempos no.
              </p>
            )}

            <StepList>
              {showAdapted
                ? adapted.steps.map((text, index) => (
                    <Step key={index} index={index}>
                      {text}
                    </Step>
                  ))
                : steps.map((step, index) => (
                    <Step key={step.id} index={index}>
                      {scaleStepText(step.text, ingredients, factor).map((segment, i) =>
                        segment.scaled ? (
                          <strong key={i} className="font-semibold">
                            {segment.text}
                          </strong>
                        ) : (
                          <span key={i}>{segment.text}</span>
                        ),
                      )}
                    </Step>
                  ))}
            </StepList>
          </>
        )}
      </section>
    </>
  );
}
