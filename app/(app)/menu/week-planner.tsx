"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Loader2,
  Minus,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WeekNav } from "@/components/week-nav";
import type { MenuItemView, RecipeOption } from "@/lib/menu/queries";
import { DEFAULT_SERVINGS, MEALS, slotKey, type Meal } from "@/lib/menu/schema";
import { cn } from "@/lib/utils";
import {
  addCookidooRecipe,
  clearSlot,
  clearWeek,
  generateWeek,
  regenerateSlot,
  setSlot,
  setSlotServings,
  type MenuResult,
} from "./actions";
import { SlotPicker } from "./slot-picker";

const MEAL_LABELS: Record<Meal, string> = { comida: "Comida", cena: "Cena" };
const MEAL_ICONS = {
  comida: { Icon: Sun, color: "text-amber-500" },
  cena: { Icon: Moon, color: "text-indigo-400" },
} as const;

type Slot = { date: string; meal: Meal };

export function WeekPlanner({
  weekStart,
  prevWeek,
  nextWeek,
  isCurrentWeek,
  rangeLabel,
  today,
  days,
  items,
  recipes,
}: {
  weekStart: string;
  prevWeek: string;
  nextWeek: string;
  isCurrentWeek: boolean;
  rangeLabel: string;
  today: string;
  days: { date: string; label: string }[];
  items: MenuItemView[];
  recipes: RecipeOption[];
}) {
  const [picker, setPicker] = useState<(Slot & { label: string }) | null>(null);
  const [pending, startTransition] = useTransition();
  // Only today starts open; the user's own taps win over that default.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const bySlot = useMemo(
    () =>
      new Map(
        items.filter((i) => i.recipe).map((i) => [slotKey(i.date, i.meal), i]),
      ),
    [items],
  );
  const usedIds = useMemo(
    () => new Set(items.flatMap((i) => (i.recipe ? [i.recipe.id] : []))),
    [items],
  );
  const emptyCount = days.length * MEALS.length - bySlot.size;

  const slotInput = (slot: Slot) => ({ weekStart, ...slot });

  /** Runs a server action, shows its outcome and optionally closes the picker. */
  function run(
    action: () => Promise<MenuResult>,
    options?: { success?: string; closePicker?: boolean },
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (options?.success || result.message) {
        toast.success(options?.success ?? "Hecho", {
          description: result.message ?? undefined,
          duration: result.message ? 15_000 : 4_000,
        });
      }
      if (options?.closePicker) setPicker(null);
    });
  }

  const current = picker
    ? bySlot.get(slotKey(picker.date, picker.meal))
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-semibold">Menú semanal</h1>

      <WeekNav
        basePath="/menu"
        prevWeek={prevWeek}
        nextWeek={nextWeek}
        isCurrentWeek={isCurrentWeek}
        rangeLabel={rangeLabel}
      />

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button
          type="button"
          size="lg"
          disabled={pending || emptyCount === 0 || recipes.length === 0}
          onClick={() =>
            run(() => generateWeek(weekStart), { success: "Menú generado" })
          }
        >
          {pending && !picker ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Sparkles />
          )}
          {pending && !picker
            ? "Pensando el menú… (hasta un minuto)"
            : "Generar con IA los huecos vacíos"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={pending || bySlot.size === 0}
          onClick={() => {
            if (window.confirm("¿Vaciar todos los huecos de esta semana?")) {
              run(() => clearWeek(weekStart), { success: "Semana vaciada" });
            }
          }}
          aria-label="Vaciar semana"
        >
          <Trash2 />
        </Button>
      </div>
      {recipes.length === 0 && (
        <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
          Primero necesitas guardar algunas recetas.{" "}
          <Link href="/recetas/nueva" className="underline underline-offset-4">
            Crear una
          </Link>
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {days.map(({ date, label }) => {
          const open = toggled[date] ?? date === today;
          return (
            <li
              key={date}
              className={cn(
                "rounded-xl border p-3",
                date === today && "border-primary",
              )}
            >
              <button
                type="button"
                aria-expanded={open}
                onClick={() =>
                  setToggled((prev) => ({ ...prev, [date]: !open }))
                }
                className="flex w-full items-center gap-2 text-left"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <h2 className="font-heading font-medium capitalize">
                      {label}
                    </h2>
                    {date === today && <Badge>Hoy</Badge>}
                  </span>
                  {!open && (
                    <span className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      {MEALS.map((meal) => {
                        const { Icon, color } = MEAL_ICONS[meal];
                        const title = bySlot.get(slotKey(date, meal))?.recipe
                          ?.title;
                        return (
                          <span
                            key={meal}
                            className="flex items-center gap-1.5"
                          >
                            <Icon
                              className={cn("size-3.5 shrink-0", color)}
                              aria-hidden
                            />
                            <span
                              className={cn("truncate", !title && "italic")}
                            >
                              {title ?? "Sin planificar"}
                            </span>
                          </span>
                        );
                      })}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    "size-5 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
              {open && (
                <div className="mt-2 flex flex-col divide-y">
                  {MEALS.map((meal) => {
                    const item = bySlot.get(slotKey(date, meal));
                    const slot = { date, meal };
                    return (
                      <div key={meal} className="flex items-center gap-3 py-2">
                        <span className="flex w-16 shrink-0 flex-col items-start gap-0.5 text-xs text-muted-foreground uppercase">
                          {(() => {
                            const { Icon, color } = MEAL_ICONS[meal];
                            return (
                              <Icon
                                className={cn("size-4", color)}
                                aria-hidden
                              />
                            );
                          })()}
                          {MEAL_LABELS[meal]}
                        </span>
                        {item?.recipe ? (
                          <>
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setPicker({
                                    ...slot,
                                    label: `${MEAL_LABELS[meal]} · ${label}`,
                                  })
                                }
                                className="truncate text-left font-medium"
                                aria-label={`Cambiar ${item.recipe.title}`}
                              >
                                {item.recipe.title}
                              </button>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Users className="size-3.5" aria-hidden />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  disabled={pending || item.servings <= 1}
                                  onClick={() =>
                                    run(() =>
                                      setSlotServings({
                                        slot: slotInput(slot),
                                        servings: item.servings - 1,
                                      }),
                                    )
                                  }
                                  aria-label="Una ración menos"
                                >
                                  <Minus />
                                </Button>
                                <span aria-label={`${item.servings} raciones`}>
                                  {item.servings}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  disabled={pending || item.servings >= 100}
                                  onClick={() =>
                                    run(() =>
                                      setSlotServings({
                                        slot: slotInput(slot),
                                        servings: item.servings + 1,
                                      }),
                                    )
                                  }
                                  aria-label="Una ración más"
                                >
                                  <Plus />
                                </Button>
                              </div>
                            </div>
                            <Link
                              href={`/recetas/${item.recipe.id}`}
                              className="text-xs text-muted-foreground underline underline-offset-4"
                            >
                              Ver
                            </Link>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={pending}
                              onClick={() =>
                                run(() => clearSlot(slotInput(slot)), {
                                  success: `${MEAL_LABELS[meal]} quitada del menú`,
                                })
                              }
                              aria-label={`Quitar ${item.recipe.title} del menú`}
                            >
                              <Trash2 />
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 justify-start text-muted-foreground"
                            onClick={() =>
                              setPicker({
                                ...slot,
                                label: `${MEAL_LABELS[meal]} · ${label}`,
                              })
                            }
                            disabled={pending}
                          >
                            <Plus /> Añadir
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {picker && (
        <SlotPicker
          title={picker.label}
          recipes={recipes}
          currentRecipeId={current?.recipe?.id ?? null}
          usedIds={usedIds}
          pending={pending}
          onClose={() => setPicker(null)}
          onSelect={(recipeId) =>
            run(
              () =>
                setSlot({
                  slot: slotInput(picker),
                  recipeId,
                  servings: current?.servings ?? DEFAULT_SERVINGS,
                }),
              { closePicker: true },
            )
          }
          onRegenerate={() =>
            run(() => regenerateSlot(slotInput(picker)), {
              success: "Receta propuesta",
              closePicker: true,
            })
          }
          onAddCookidoo={(url) =>
            run(
              () =>
                addCookidooRecipe({
                  slot: slotInput(picker),
                  url,
                  servings: current?.servings ?? DEFAULT_SERVINGS,
                }),
              { success: "Receta de Cookidoo añadida", closePicker: true },
            )
          }
          onClear={() =>
            run(() => clearSlot(slotInput(picker)), { closePicker: true })
          }
        />
      )}
    </div>
  );
}
