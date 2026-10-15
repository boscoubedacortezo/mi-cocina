"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ClipboardCopy, Plus, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyText } from "@/lib/clipboard";
import { daysInRange, formatDateRange, mondayOf } from "@/lib/menu/dates";
import {
  SHOP_SECTIONS,
  UNITS,
  type ShopSection,
  type Unit,
} from "@/lib/recipes/constants";
import { SECTION_DOT } from "@/lib/shopping/colors";
import {
  buildShoppingText,
  capitalize,
  formatAmount,
} from "@/lib/shopping/format";
import type { ShoppingEntry, ShoppingListData } from "@/lib/shopping/queries";
import { cn, selectClass } from "@/lib/utils";
import {
  addShoppingItem,
  deleteManualItem,
  setLineState,
  setShoppingRange,
  toggleManualItem,
} from "./actions";

type Preset = { label: string; start: string; end: string };

type OptimisticAction =
  | { type: "toggle"; id: string; checked: boolean }
  | { type: "remove"; id: string };

export function ShoppingList({
  list,
  presets,
}: {
  list: ShoppingListData;
  presets: Preset[];
}) {
  const [pending, startTransition] = useTransition();
  const [visible, applyOptimistic] = useOptimistic(
    list.items,
    (state, action: OptimisticAction) =>
      action.type === "toggle"
        ? state.map((item) =>
            item.id === action.id ? { ...item, checked: action.checked } : item,
          )
        : state.filter((item) => item.id !== action.id),
  );

  // The period; changing it saves it, and the list follows the menu for those days.
  const [start, setStart] = useState(list.range.start);
  const [end, setEnd] = useState(list.range.end);
  const rangeValid = (from: string, to: string) =>
    Boolean(from && to && to >= from && daysInRange(from, to) <= 63);

  function applyRange(nextStart: string, nextEnd: string) {
    setStart(nextStart);
    setEnd(nextEnd);
    if (!rangeValid(nextStart, nextEnd)) return;
    startTransition(async () => {
      const result = await setShoppingRange({ start: nextStart, end: nextEnd });
      if (!result.ok) toast.error(result.error);
    });
  }

  const [adding, setAdding] = useState(false);
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
              Number(a.checked) - Number(b.checked) ||
              a.name.localeCompare(b.name, "es"),
          ),
      })).filter((group) => group.items.length > 0),
    [visible],
  );
  const bought = visible.filter((item) => item.checked).length;

  /** Marks a line from the menu (bought, removed, pending) or acts on one added by hand. */
  function mark(item: ShoppingEntry, state: "pending" | "checked" | "removed") {
    startTransition(async () => {
      // Immediate feedback, in the same step as the server call so it does not flicker.
      applyOptimistic(
        state === "removed"
          ? { type: "remove", id: item.id }
          : { type: "toggle", id: item.id, checked: state === "checked" },
      );
      const result = item.key
        ? await setLineState({
            range: { start, end },
            item: {
              key: item.key,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              shop_section: item.shop_section,
            },
            state,
          })
        : state === "removed"
          ? await deleteManualItem(item.id)
          : await toggleManualItem(item.id, state === "checked");
      if (!result.ok) toast.error(result.error);
    });
  }

  function toggle(item: ShoppingEntry) {
    mark(item, item.checked ? "pending" : "checked");
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
        range: { start, end },
        item: {
          name,
          quantity: parsedQuantity,
          unit: unit || null,
          shop_section: section,
        },
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
    const label = list.range
      ? formatDateRange(list.range.start, list.range.end)
      : "";
    copyText(
      buildShoppingText(label, toBuy),
      `Lista (${toBuy.length} artículos)`,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-semibold">
        Lista de la compra
      </h1>

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
                onClick={() => applyRange(preset.start, preset.end)}
              >
                <Badge
                  variant={active ? "default" : "outline"}
                  className="px-3 py-1 text-sm"
                >
                  {preset.label}
                </Badge>
              </button>
            );
          })}
        </div>
        {/* One above the other on phones: date fields have a minimum width of their own
            (iOS especially) and overlap when squeezed into two columns. */}
        <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="range-start">Desde</Label>
            <Input
              id="range-start"
              type="date"
              className="w-full min-w-0"
              value={start}
              onChange={(e) => applyRange(e.target.value, end)}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="range-end">Hasta</Label>
            <Input
              id="range-end"
              type="date"
              className="w-full min-w-0"
              min={start}
              value={end}
              onChange={(e) => applyRange(start, e.target.value)}
            />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={copyList}
          disabled={visible.length === 0}
        >
          <ClipboardCopy /> Copiar lista
        </Button>
        <p className="text-sm text-muted-foreground">
          {!rangeValid(start, end) ? (
            "Elige un periodo válido (la fecha final no puede ser anterior a la inicial, máximo 9 semanas)."
          ) : list.plannedMeals === 0 ? (
            <>
              No hay recetas en el menú de esos días.{" "}
              <Link
                href={`/menu?semana=${mondayOf(start)}`}
                className="underline underline-offset-4"
              >
                Planificar el menú
              </Link>
            </>
          ) : (
            `La lista se actualiza sola con el menú: ${list.plannedMeals} ${list.plannedMeals === 1 ? "comida" : "comidas"} del ${formatDateRange(start, end)}.`
          )}
        </p>
      </section>

      {!adding && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => setAdding(true)}
        >
          <Plus /> Añadir artículo
        </Button>
      )}
      {adding && (
        <form
          onSubmit={add}
          className="flex flex-col gap-2 rounded-xl border p-3"
          noValidate
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Añadir artículo</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setAdding(false)}
              aria-label="Cerrar"
            >
              <X />
            </Button>
          </div>
          <Input
            autoFocus
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
      )}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          La lista está vacía.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {bought} de {visible.length} comprados. Quita con la papelera lo que
            ya tengas en casa.
          </p>
          {groups.map((group) => (
            <section key={group.section} className="flex flex-col gap-1">
              <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    SECTION_DOT[group.section],
                  )}
                  aria-hidden
                />
                {group.section}
              </h2>
              <ul className="divide-y rounded-xl border">
                {group.items.map((item) => {
                  const amount = formatAmount(item.quantity, item.unit);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 px-3 py-2"
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={item.checked}
                        aria-label={`${capitalize(item.name)}: ${item.checked ? "marcar como pendiente" : "marcar como comprado"}`}
                        onClick={() => toggle(item)}
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border",
                          item.checked &&
                            "border-primary bg-primary text-primary-foreground",
                        )}
                      >
                        {item.checked && (
                          <Check className="size-4" aria-hidden />
                        )}
                      </button>
                      <div
                        className={cn(
                          "flex min-w-0 flex-1 items-center justify-between gap-2",
                          item.checked && "text-muted-foreground line-through",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">
                            {capitalize(item.name)}
                          </span>
                          {item.is_manual && (
                            <Badge variant="outline">Manual</Badge>
                          )}
                        </span>
                        <span className="flex shrink-0 flex-col items-end">
                          {amount && <span className="text-sm">{amount}</span>}
                          {item.changedFrom && (
                            <span className="text-xs text-muted-foreground">
                              antes {item.changedFrom}
                            </span>
                          )}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => mark(item, "removed")}
                        aria-label={
                          item.is_manual
                            ? `Borrar ${item.name}`
                            : `Quitar ${item.name} de la lista (ya lo tengo)`
                        }
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
                <li
                  key={item.id}
                  className="flex items-center gap-2 py-2 text-muted-foreground"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {capitalize(item.name)}
                  </span>
                  {amount && <span className="shrink-0 text-sm">{amount}</span>}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => mark(item, "pending")}
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
