// Weeks are handled as "YYYY-MM-DD" strings (never Date objects across the
// server/client boundary) so time zones can't shift a day.

const DAY_MS = 86_400_000;

export function parseIso(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso
    ? null
    : date;
}

export function addDays(iso: string, days: number) {
  const date = parseIso(iso)!;
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string) {
  return Math.round((parseIso(to)!.getTime() - parseIso(from)!.getTime()) / DAY_MS);
}

/** Monday of the week containing `iso`. */
export function mondayOf(iso: string) {
  const dayIndex = (parseIso(iso)!.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(iso, -dayIndex);
}

export function todayInMadrid() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

export function weekDates(monday: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const dayFormat = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "Lunes, 12 de octubre": only the first letter is capitalised, as in Spanish. */
export function formatDay(iso: string) {
  const text = dayFormat.format(parseIso(iso)!);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatWeekRange(monday: string) {
  const short = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return `${short.format(parseIso(monday)!)} – ${short.format(parseIso(addDays(monday, 6))!)}`;
}

/** Monday of the week named by a `?semana=` param, or of the current week. */
export function resolveWeek(param: string | string[] | undefined, today: string) {
  const value = Array.isArray(param) ? param[0] : param;
  return value && parseIso(value) ? mondayOf(value) : mondayOf(today);
}

/** Last day of the month containing `iso`. */
export function lastDayOfMonth(iso: string) {
  const date = parseIso(iso)!;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

/** "19 oct – 1 nov" (or just "19 oct" for a single day). */
export function formatDateRange(start: string, end: string) {
  const short = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
  const from = short.format(parseIso(start)!);
  return start === end ? from : `${from} – ${short.format(parseIso(end)!)}`;
}

/** Days from `start` to `end`, both included. */
export function daysInRange(start: string, end: string) {
  const from = parseIso(start);
  const to = parseIso(end);
  if (!from || !to) return Number.NaN;
  return Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
}
