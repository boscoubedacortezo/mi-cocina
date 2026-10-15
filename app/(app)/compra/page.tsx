import type { Metadata } from "next";
import { addDays, lastDayOfMonth, mondayOf, todayInMadrid } from "@/lib/menu/dates";
import { getShoppingList } from "@/lib/shopping/queries";
import { DEFAULT_RANGE_DAYS } from "@/lib/shopping/schema";
import { ShoppingList } from "./shopping-list";

export const metadata: Metadata = { title: "Lista de la compra" };

export default async function ShoppingPage() {
  const today = todayInMadrid();

  // Quick choices for the period; the first one is the default.
  const presets = [
    { label: `${DEFAULT_RANGE_DAYS} días desde hoy`, start: today, end: addDays(today, DEFAULT_RANGE_DAYS - 1) },
    { label: "Esta semana", start: today, end: addDays(mondayOf(today), 6) },
    { label: "Resto del mes", start: today, end: lastDayOfMonth(today) },
  ];

  const list = await getShoppingList({ start: presets[0].start, end: presets[0].end });
  return <ShoppingList list={list} presets={presets} />;
}
