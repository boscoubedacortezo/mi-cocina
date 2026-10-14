import type { Metadata } from "next";
import {
  addDays,
  formatDay,
  formatWeekRange,
  mondayOf,
  resolveWeek,
  todayInMadrid,
  weekDates,
} from "@/lib/menu/dates";
import { getWeekItems, listRecipeOptions } from "@/lib/menu/queries";
import { WeekPlanner } from "./week-planner";

export const metadata: Metadata = { title: "Menú semanal" };

// The AI menu server actions run under this page: allow time for the model.
export const maxDuration = 60;

export default async function MenuPage({ searchParams }: PageProps<"/menu">) {
  const today = todayInMadrid();
  const weekStart = resolveWeek((await searchParams).semana, today);

  const [items, recipes] = await Promise.all([getWeekItems(weekStart), listRecipeOptions()]);

  return (
    <WeekPlanner
      weekStart={weekStart}
      prevWeek={addDays(weekStart, -7)}
      nextWeek={addDays(weekStart, 7)}
      isCurrentWeek={weekStart === mondayOf(today)}
      rangeLabel={formatWeekRange(weekStart)}
      today={today}
      days={weekDates(weekStart).map((date) => ({ date, label: formatDay(date) }))}
      items={items}
      recipes={recipes}
    />
  );
}
