"use client";

import { useState, useTransition } from "react";
import { Check, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  WEEKLY_MINIMUMS,
  type MenuPreferences,
  type WeeklyMinimum,
} from "@/lib/menu/preferences";
import type { Meal } from "@/lib/menu/schema";
import { cn, selectClass } from "@/lib/utils";
import { saveMenuPreferences } from "./actions";

const MEAL_OPTIONS = [
  { meal: "comida", label: "Comida", Icon: Sun, color: "text-amber-500" },
  { meal: "cena", label: "Cena", Icon: Moon, color: "text-indigo-400" },
] as const;

const MINIMUM_LABELS: Record<WeeklyMinimum, string> = {
  pescado: "Pescado",
  legumbres: "Legumbres",
  verdura: "Verdura",
};

/** Days are stored; the form shows whole weeks when it can. */
function splitRepeat(days: number) {
  return days >= 7 && days % 7 === 0
    ? { value: String(days / 7), unit: "weeks" as const }
    : { value: String(days), unit: "days" as const };
}

function CheckRow({
  checked,
  onChange,
  children,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full items-center gap-3 py-2 text-left"
    >
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md border",
          checked && "border-primary bg-primary text-primary-foreground",
        )}
      >
        {checked && <Check className="size-4" aria-hidden />}
      </span>
      <span className="flex flex-col">
        <span className="font-medium">{children}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </span>
    </button>
  );
}

export function MenuPreferencesForm({ initial }: { initial: MenuPreferences }) {
  const [pending, startTransition] = useTransition();
  const [servings, setServings] = useState(String(initial.servings));
  const [meals, setMeals] = useState<Meal[]>(initial.meals);
  const initialRepeat = splitRepeat(initial.noRepeatDays);
  const [repeatValue, setRepeatValue] = useState(initialRepeat.value);
  const [repeatUnit, setRepeatUnit] = useState<"days" | "weeks">(initialRepeat.unit);
  const [onlyMains, setOnlyMains] = useState(initial.onlyMains);
  const [varietyMain, setVarietyMain] = useState(initial.varietyMain);
  const [longerOnWeekend, setLongerOnWeekend] = useState(initial.longerOnWeekend);
  const [minimums, setMinimums] = useState<Record<WeeklyMinimum, string>>({
    pescado: String(initial.minPerWeek.pescado),
    legumbres: String(initial.minPerWeek.legumbres),
    verdura: String(initial.minPerWeek.verdura),
  });
  const [notes, setNotes] = useState(initial.notes);

  const toNumber = (text: string) => (text.trim() === "" ? NaN : Number(text.replace(",", ".")));
  const repeatNumber = toNumber(repeatValue);
  const repeatDays = repeatNumber * (repeatUnit === "weeks" ? 7 : 1);

  function toggleMeal(meal: Meal) {
    setMeals((current) =>
      current.includes(meal) ? current.filter((item) => item !== meal) : [...current, meal],
    );
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      servings: toNumber(servings),
      meals,
      noRepeatDays: repeatDays,
      onlyMains,
      varietyMain,
      minPerWeek: {
        pescado: toNumber(minimums.pescado),
        legumbres: toNumber(minimums.legumbres),
        verdura: toNumber(minimums.verdura),
      },
      longerOnWeekend,
      notes,
    };
    startTransition(async () => {
      const result = await saveMenuPreferences(payload);
      if (result.ok) toast.success("Preferencias guardadas");
      else toast.error(result.error);
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pref-servings">Raciones por defecto</Label>
        <Input
          id="pref-servings"
          inputMode="numeric"
          className="w-24"
          value={servings}
          onChange={(e) => setServings(e.target.value)}
        />
      </div>

      <fieldset className="flex flex-col">
        <legend className="mb-1 text-sm font-medium">Qué planificas</legend>
        <div className="flex flex-col divide-y">
          {MEAL_OPTIONS.map(({ meal, label, Icon, color }) => (
            <CheckRow key={meal} checked={meals.includes(meal)} onChange={() => toggleMeal(meal)}>
              <span className="flex items-center gap-2">
                <Icon className={cn("size-4", color)} aria-hidden /> {label}
              </span>
            </CheckRow>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pref-repeat">No repetir la misma receta en…</Label>
        <div className="flex gap-2">
          <Input
            id="pref-repeat"
            inputMode="numeric"
            className="w-24"
            value={repeatValue}
            onChange={(e) => setRepeatValue(e.target.value)}
          />
          <select
            value={repeatUnit}
            onChange={(e) => setRepeatUnit(e.target.value as "days" | "weeks")}
            className={cn(selectClass, "w-32")}
            aria-label="Unidad"
          >
            <option value="days">días</option>
            <option value="weeks">semanas</option>
          </select>
        </div>
        <p className="text-xs text-muted-foreground">
          {Number.isFinite(repeatDays) && repeatDays === 0
            ? "Sin límite: la IA puede repetir recetas."
            : "Vale entre semanas: la IA mira también los días cercanos de otras semanas. 0 = sin límite."}
        </p>
      </div>

      <fieldset className="flex flex-col">
        <legend className="mb-1 text-sm font-medium">Cómo elige la IA</legend>
        <div className="flex flex-col divide-y">
          <CheckRow
            checked={onlyMains}
            onChange={() => setOnlyMains((v) => !v)}
            description="Si no, también puede usar entrantes o acompañamientos que sirvan de plato completo."
          >
            Solo platos principales
          </CheckRow>
          <CheckRow
            checked={varietyMain}
            onChange={() => setVarietyMain((v) => !v)}
            description="No pone carne dos veces seguidas, ni el mismo principal el mismo día."
          >
            Alternar el ingrediente principal
          </CheckRow>
          <CheckRow
            checked={longerOnWeekend}
            onChange={() => setLongerOnWeekend((v) => !v)}
            description="Deja las recetas más largas para sábado y domingo."
          >
            Recetas largas en fin de semana
          </CheckRow>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium">Mínimo por semana (ingrediente principal)</legend>
        <div className="grid grid-cols-3 gap-2">
          {WEEKLY_MINIMUMS.map((key) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={`pref-min-${key}`} className="text-xs text-muted-foreground">
                {MINIMUM_LABELS[key]}
              </Label>
              <Input
                id={`pref-min-${key}`}
                inputMode="numeric"
                value={minimums[key]}
                onChange={(e) => setMinimums((m) => ({ ...m, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">0 = sin mínimo.</p>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pref-notes">Notas para la IA</Label>
        <Textarea
          id="pref-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          placeholder="Sin cordero, cenas rápidas entre semana…"
        />
      </div>

      <Button type="submit" size="lg" disabled={pending || meals.length === 0}>
        {pending ? "Guardando…" : "Guardar preferencias"}
      </Button>
    </form>
  );
}
