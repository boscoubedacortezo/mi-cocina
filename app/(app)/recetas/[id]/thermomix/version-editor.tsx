"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TM_ACCESSORIES,
  TM_MODE_LABELS,
  TM_MODES,
  TM_SPEEDS,
  TM_TEMPERATURES,
  type TmAccessory,
  type TmMode,
  type TmSpeed,
} from "@/lib/thermomix/constants";
import { thermomixInputSchema, type ThermomixStep } from "@/lib/thermomix/schema";
import { moveItem, selectClass } from "@/lib/utils";
import { saveThermomixVersion } from "./actions";
import type { VersionData } from "./version-view";

type Row = {
  key: string;
  text: string;
  minutes: string;
  seconds: string;
  temperature: string;
  speed: TmSpeed | "";
  reverse: boolean;
  accessory: TmAccessory | "";
  mode: TmMode | "";
};

const newKey = () => crypto.randomUUID();

const emptyRow = (): Row => ({
  key: newKey(),
  text: "",
  minutes: "",
  seconds: "",
  temperature: "",
  speed: "",
  reverse: false,
  accessory: "",
  mode: "",
});

function toRow(step: ThermomixStep): Row {
  return {
    key: newKey(),
    text: step.text,
    minutes: step.time_seconds ? String(Math.floor(step.time_seconds / 60)) : "",
    seconds: step.time_seconds ? String(step.time_seconds % 60) : "",
    temperature: step.temperature === null ? "" : String(step.temperature),
    speed: step.speed ?? "",
    reverse: step.reverse,
    accessory: step.accessory ?? "",
    mode: step.mode ?? "",
  };
}

function toNumber(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? 0 : Number(trimmed);
}

export function VersionEditor({
  recipeId,
  version,
  onDone,
}: {
  recipeId: string;
  version: VersionData;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [servings, setServings] = useState(String(version.servings));
  const [ingredients, setIngredients] = useState(version.ingredients_text);
  const [rows, setRows] = useState<Row[]>(
    version.steps.length ? version.steps.map(toRow) : [emptyRow()],
  );

  const update = (key: string, patch: Partial<Row>) =>
    setRows(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    const times = rows.map((row) => toNumber(row.minutes) * 60 + toNumber(row.seconds));
    if (times.some((t) => !Number.isFinite(t) || t < 0)) {
      toast.error("Hay un tiempo que no es un número.");
      return;
    }

    const parsed = thermomixInputSchema.safeParse({
      servings: servings.trim() === "" ? undefined : Number(servings),
      ingredients_text: ingredients,
      steps: rows
        .map((row, i) => ({ row, seconds: times[i] }))
        .filter(({ row }) => row.text.trim())
        .map(({ row, seconds }) => ({
          text: row.text,
          // Amasar only takes a time; Cocción de arroz takes nothing.
          time_seconds:
            row.mode !== "arroz" && seconds > 0 ? Math.round(seconds) : null,
          temperature:
            row.mode !== "" || row.temperature === ""
              ? null
              : row.temperature === "Varoma"
                ? "Varoma"
                : Number(row.temperature),
          speed: row.mode !== "" ? null : row.speed || null,
          reverse: row.mode === "" && (row.reverse || row.speed === "cuchara"),
          accessory: row.mode === "amasar" ? null : row.accessory || null,
          mode: row.mode || null,
        })),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    startTransition(async () => {
      const result = await saveThermomixVersion(recipeId, version.id, parsed.data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cambios guardados");
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="tm-servings">Raciones</Label>
        <Input
          id="tm-servings"
          inputMode="numeric"
          value={servings}
          onChange={(e) => setServings(e.target.value)}
          className="w-28"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tm-ingredients">Ingredientes (uno por línea)</Label>
        <Textarea
          id="tm-ingredients"
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          rows={Math.min(14, Math.max(5, ingredients.split("\n").length + 1))}
          maxLength={5000}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Pasos</h2>
        <ol className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <li key={row.key} className="flex flex-col gap-3 rounded-xl border p-3">
              <Label htmlFor={`tm-step-${row.key}`}>Paso {index + 1}</Label>
              <Textarea
                id={`tm-step-${row.key}`}
                value={row.text}
                onChange={(e) => update(row.key, { text: e.target.value })}
                rows={3}
                maxLength={2000}
              />
              <select
                value={row.mode}
                onChange={(e) => {
                  const mode = e.target.value as TmMode | "";
                  update(row.key, {
                    mode,
                    ...(mode
                      ? { temperature: "", speed: "", reverse: false, accessory: "" }
                      : {}),
                    ...(mode === "arroz" ? { minutes: "", seconds: "" } : {}),
                  });
                }}
                className={selectClass}
                aria-label="Modo"
              >
                <option value="">Sin modo (ajustes manuales)</option>
                {TM_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    Modo {TM_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex gap-2">
                  <Input
                    disabled={row.mode === "arroz"}
                    value={row.minutes}
                    onChange={(e) => update(row.key, { minutes: e.target.value })}
                    inputMode="numeric"
                    placeholder="min"
                    aria-label="Minutos"
                  />
                  <Input
                    disabled={row.mode === "arroz"}
                    value={row.seconds}
                    onChange={(e) => update(row.key, { seconds: e.target.value })}
                    inputMode="numeric"
                    placeholder="seg"
                    aria-label="Segundos"
                  />
                </div>
                <select
                  value={row.temperature}
                  onChange={(e) => update(row.key, { temperature: e.target.value })}
                  className={selectClass}
                  disabled={row.mode !== ""}
                  aria-label="Temperatura"
                >
                  <option value="">Sin temperatura</option>
                  {TM_TEMPERATURES.map((t) => (
                    <option key={t} value={t}>
                      {t} °C
                    </option>
                  ))}
                  <option value="Varoma">Varoma</option>
                </select>
                <select
                  value={row.speed}
                  onChange={(e) => {
                    const speed = e.target.value as TmSpeed | "";
                    update(row.key, {
                      speed,
                      reverse: speed === "cuchara" ? true : row.reverse,
                    });
                  }}
                  className={selectClass}
                  disabled={row.mode !== ""}
                  aria-label="Velocidad"
                >
                  <option value="">Sin velocidad</option>
                  {TM_SPEEDS.map((s) => (
                    <option key={s} value={s}>
                      vel {s}
                    </option>
                  ))}
                </select>
                <select
                  value={row.accessory}
                  onChange={(e) =>
                    update(row.key, { accessory: e.target.value as TmAccessory | "" })
                  }
                  className={selectClass}
                  disabled={row.mode !== ""}
                  aria-label="Accesorio"
                >
                  <option value="">Sin accesorio</option>
                  {TM_ACCESSORIES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.reverse || row.speed === "cuchara"}
                    disabled={row.speed === "cuchara" || row.mode !== ""}
                    onChange={(e) => update(row.key, { reverse: e.target.checked })}
                    className="size-4"
                  />
                  Giro inverso
                </label>
                <div className="flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    onClick={() => setRows(moveItem(rows, index, index - 1))}
                    aria-label="Subir paso"
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === rows.length - 1}
                    onClick={() => setRows(moveItem(rows, index, index + 1))}
                    aria-label="Bajar paso"
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                    aria-label="Quitar paso"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <Button type="button" variant="outline" onClick={() => setRows([...rows, emptyRow()])}>
          <Plus /> Añadir paso
        </Button>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
