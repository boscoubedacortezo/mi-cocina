import type { Metadata } from "next";
import { addDays, formatWeekRange, mondayOf, resolveWeek, todayInMadrid } from "@/lib/menu/dates";
import { getShoppingList } from "@/lib/shopping/queries";
import { ShoppingList } from "./shopping-list";

export const metadata: Metadata = { title: "Lista de la compra" };

export default async function ShoppingPage({ searchParams }: PageProps<"/compra">) {
  const today = todayInMadrid();
  const weekStart = resolveWeek((await searchParams).semana, today);
  const { items, plannedMeals } = await getShoppingList(weekStart);

  return (
    <ShoppingList
      weekStart={weekStart}
      prevWeek={addDays(weekStart, -7)}
      nextWeek={addDays(weekStart, 7)}
      isCurrentWeek={weekStart === mondayOf(today)}
      rangeLabel={formatWeekRange(weekStart)}
      plannedMeals={plannedMeals}
      items={items}
    />
  );
}
