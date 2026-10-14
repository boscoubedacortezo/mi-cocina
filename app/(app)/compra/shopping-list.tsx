"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ClipboardCopy, ListRestart, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WeekNav } from "@/components/week-nav";
import { copyText } from "@/lib/clipboard";
import { SHOP_SECTIONS, UNITS, type ShopSection, type Unit } from "@/lib/recipes/constants";
import type { ShoppingItem } from "@/lib/shopping/queries";
import { buildShoppingText, capitalize, formatAmount } from "@/lib/shopping/format";
import { cn, selectClass } from "@/lib/utils";
import {
  addShoppingItem,
  deleteShoppingItem,
  generateShoppingList,
  toggleShoppingItem,
} from "./actions";

type OptimisticAction =
  | { type: "toggle"; id: string; checked: boolean }
  | { type: "delete"; id: string };

export function ShoppingList({
  weekStart,
  prevWeek,
  nextWeek,
  isCurrentWeek,
  rangeLabel,
  plannedMeals,
  items,
}: {
  weekStart: string;
  prevWeek: string;
  nextWeek: string;
  isCurrentWeek: boolean;
  rangeLabel: string;
  plannedMeals: number;
  items: ShoppingItem[];
}) {
  const [pending, startTransition] = useTransition();
  const [visible, applyOptimistic] = useOptimistic(items, (state, action: OptimisticAction) =>
    action.type === "toggle"
      ? state.map((item) => (item.id === action.id ? { ...item, checked: action.checked } : item))
      : state.filter((item) => item.id !== action.id),
  );

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
  const hasGenerated = visible.some((item) => !item.is_manual);

  function generate() {
    startTransition(async () => {
      const result = await generateShoppingList(weekStart);
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
      applyOptimistic({ type: "delete", id: item.id });
      const result = await deleteShoppingItem(item.id);
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
        weekStart,
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
    copyText(buildShoppingText(rangeLabel, toBuy), `Lista (${toBuy.length} artículos)`);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-semibold">Lista de la compra</h1>

      <WeekNav
        basePath="/compra"
        prevWeek={prevWeek}
        nextWeek={nextWeek}
        isCurrentWeek={isCurrentWeek}
        rangeLabel={rangeLabel}
      />

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button type="button" size="lg" onClick={generate} disabled={pending || plannedMeals === 0}>
          {pending ? <Loader2 className="animate-spin" /> : <ListRestart />}
          {hasGenerated ? "Regenerar desde el menú" : "Generar desde el menú"}
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
        {plannedMeals === 0 ? (
          <>
            Esta semana no tiene recetas en el menú.{" "}
            <Link href={`/menu?semana=${weekStart}`} className="underline underline-offset-4">
              Planificarla
            </Link>
          </>
        ) : hasGenerated ? (
          "Si cambias el menú, regenera la lista: se mantienen tus artículos y lo que ya has marcado."
        ) : (
          `Se calculará con las ${plannedMeals} comidas del menú, según sus raciones.`
        )}
      </p>

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
            {bought} de {visible.length} comprados
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
                        aria-label={`Quitar ${item.name}`}
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
    </div>
  );
}
