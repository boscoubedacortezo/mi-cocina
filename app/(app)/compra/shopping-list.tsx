"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ClipboardCopy, ListRestart, Loader2, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyText } from "@/lib/clipboard";
import { daysInRange, formatDateRange, mondayOf } from "@/lib/menu/dates";
import { SHOP_SECTIONS, UNITS, type ShopSection, type Unit } from "@/lib/recipes/constants";
import { buildShoppingText, capitalize, formatAmount } from "@/lib/shopping/format";
import type { ShoppingItem, ShoppingList as List } from "@/lib/shopping/queries";
import { cn, selectClass } from "@/lib/utils";
import {
  addShoppingItem,
  generateShoppingList,
  removeShoppingItem,
  restoreShoppingItem,
  toggleShoppingItem,
} from "./actions";

type Preset = { label: string; start: string; end: string };

type OptimisticAction =
  | { type: "toggle"; id: string; checked: boolean }
  | { type: "remove"; id: string };

export function ShoppingList({ list, presets }: { list: List; presets: Preset[] }) {
  const [pending, startTransition] = useTransition();
  const [visible, applyOptimistic] = useOptimistic(list.items, (state, action: OptimisticAction) =>
    action.type === "toggle"
      ? state.map((item) => (item.id === action.id ? { ...item, checked: action.checked } : item))
      : state.filter((item) => item.id !== action.id),
  );

  // The period being edited; starts as the saved one, or the first quick choice.
  const [start, setStart] = useState(list.range?.start ?? presets[0].start);
  const [end, setEnd] = useState(list.range?.end ?? presets[0].end);
  const changedRange = !list.range || list.range.start !== start || list.range.end !== end;
  const rangeValid = Boolean(start && end && end >= start && daysInRange(start, end) <= 63);

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<Unit | "">("");
  const [section, setSection] = useState<ShopSection>("Otros");

  const groups = useMemo(
    () =>
      SHOP_SECTIONS.map((sectionName) => ({
        section: sectionName,
        items: visible
          .filter((item) => item.shop_section === sectionName)
          .sort(
            (a, b) =>
              Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name, "es"),
          ),
      })).filter((group) => group.items.length > 0),
    [visible],
  );
  const bought = visible.filter((item) => item.checked).length;
  const hasGenerated = visible.some((item) => !item.is_manual) || list.removed.length > 0;

  function generate() {
    startTransition(async () => {
      const result = await generateShoppingList({ start, end });
      if (!result.ok) toast.error(result.error);
      else toast.success("Lista generada", { description: result.message ?? undefined });
    });
  }

  function toggle(item: ShoppingItem) {
    startTransition(async () => {
      applyOptimistic({ type: "toggle", id: item.id, checked: !item.checked });
      const result = await toggleShoppingItem(item.id, !item.checked);
      if (!result.ok) toast.error(result.error);
    });
  }

  function remove(item: ShoppingItem) {
    startTransition(async () => {
      applyOptimistic({ type: "remove", id: item.id });
      const result = await removeShoppingItem(item.id);
      if (!result.ok) toast.error(result.error);
    });
  }

  function restore(item: ShoppingItem) {
    startTransition(async () => {
      const result = await restoreShoppingItem(item.id);
      if (!result.ok) toast.error(result.error);
    });
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = quantity.trim().replace(",", ".");
    const parsedQuantity = trimmed === "" ? null : Number(trimmed);
    if (parsedQuantity !== null && !Number.isFinite(parsedQuantity)) {
      toast.error("La cantidad debe ser un número.");
      return;
    }
    startTransition(async () => {
      const result = await addShoppingItem({
        name,
        quantity: parsedQuantity,
        unit: unit || null,
        shop_section: section,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setName("");
      setQuantity("");
      setUnit("");
    });
  }

  function copyList() {
    const toBuy = visible.filter((item) => !item.checked);
    if (toBuy.length === 0) {
      toast.info("No queda nada por comprar.");
      return;
    }
    const label = list.range ? formatDateRange(list.range.start, list.range.end) : "";
    copyText(buildShoppingText(label, toBuy), `Lista (${toBuy.length} artículos)`);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-semibold">Lista de la compra</h1>

      <section className="flex flex-col gap-3 rounded-xl border p-3">
        <h2 className="text-sm font-medium">Periodo de la compra</h2>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => {
            const active = start === preset.start && end === preset.end;
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setStart(preset.start);
                  setEnd(preset.end);
                }}
              >
                <Badge variant={active ? "default" : "outline"} className="px-3 py-1 text-sm">
                  {preset.label}
                </Badge>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="range-start">Desde</Label>
            <Input id="range-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="range-end">Hasta</Label>
            <Input id="range-end" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button type="button" size="lg" onClick={generate} disabled={pending || !rangeValid}>
            {pending ? <Loader2 className="animate-spin" /> : <ListRestart />}
            {hasGenerated ? "Regenerar con este periodo" : "Generar lista"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={copyList}
            disabled={visible.length === 0}
            aria-label="Copiar lista"
          >
            <ClipboardCopy />
            <span className="hidden sm:inline">Copiar</span>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {!rangeValid ? (
            "Elige un periodo válido (la fecha final no puede ser anterior a la inicial, máximo 9 semanas)."
          ) : changedRange ? (
            `Se calculará con las comidas con receta del ${formatDateRange(start, end)}.`
          ) : list.plannedMeals === 0 ? (
            <>
              No hay recetas en el menú de esos días.{" "}
              <Link href={`/menu?semana=${mondayOf(start)}`} className="underline underline-offset-4">
                Planificar
              </Link>
            </>
          ) : (
            `Calculada con ${list.plannedMeals} ${list.plannedMeals === 1 ? "comida" : "comidas"} del ${formatDateRange(start, end)}. Si cambias el menú, regenera: se mantienen tus artículos, lo marcado y lo que quitaste.`
          )}
        </p>
      </section>

      <form onSubmit={add} className="flex flex-col gap-2 rounded-xl border p-3" noValidate>
        <h2 className="text-sm font-medium">Añadir artículo</h2>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Papel de cocina, pilas…"
          aria-label="Nombre del artículo"
          maxLength={120}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputMode="decimal"
            placeholder="Cantidad (opcional)"
            aria-label="Cantidad"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as Unit | "")}
            className={selectClass}
            aria-label="Unidad"
          >
            <option value="">Sin unidad</option>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            value={section}
            onChange={(e) => setSection(e.target.value as ShopSection)}
            className={selectClass}
            aria-label="Sección del súper"
          >
            {SHOP_SECTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={pending || !name.trim()}>
            <Plus /> Añadir
          </Button>
        </div>
      </form>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          La lista está vacía.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {bought} de {visible.length} comprados. Quita con la papelera lo que ya tengas en casa.
          </p>
          {groups.map((group) => (
            <section key={group.section} className="flex flex-col gap-1">
              <h2 className="font-heading text-lg font-semibold">{group.section}</h2>
              <ul className="divide-y rounded-xl border">
                {group.items.map((item) => {
                  const amount = formatAmount(item.quantity, item.unit);
                  return (
                    <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={item.checked}
                        aria-label={`${capitalize(item.name)}: ${item.checked ? "marcar como pendiente" : "marcar como comprado"}`}
                        onClick={() => toggle(item)}
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border",
                          item.checked && "border-primary bg-primary text-primary-foreground",
                        )}
                      >
                        {item.checked && <Check className="size-4" aria-hidden />}
                      </button>
                      <div
                        className={cn(
                          "flex min-w-0 flex-1 items-center justify-between gap-2",
                          item.checked && "text-muted-foreground line-through",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">{capitalize(item.name)}</span>
                          {item.is_manual && <Badge variant="outline">Manual</Badge>}
                        </span>
                        {amount && <span className="shrink-0 text-sm">{amount}</span>}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(item)}
                        aria-label={`Quitar ${item.name} de la lista (ya lo tengo)`}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}

      {list.removed.length > 0 && (
        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Quitados ({list.removed.length}): ya los tienes
          </summary>
          <ul className="mt-2 divide-y">
            {list.removed.map((item) => {
              const amount = formatAmount(item.quantity, item.unit);
              return (
                <li key={item.id} className="flex items-center gap-2 py-2 text-muted-foreground">
                  <span className="min-w-0 flex-1 truncate">{capitalize(item.name)}</span>
                  {amount && <span className="shrink-0 text-sm">{amount}</span>}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => restore(item)}
                    aria-label={`Volver a añadir ${item.name}`}
                  >
                    <Undo2 /> Añadir
                  </Button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
