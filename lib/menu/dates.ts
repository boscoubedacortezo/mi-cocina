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
  month: "short",
  timeZone: "UTC",
});

export function formatDay(iso: string) {
  return dayFormat.format(parseIso(iso)!);
}

export function formatWeekRange(monday: string) {
  const short = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return `${short.format(parseIso(monday)!)} – ${short.format(parseIso(addDays(monday, 6))!)}`;
}
