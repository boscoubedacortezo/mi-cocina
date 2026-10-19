/** A time written in a step ("hornear 20 minutos", "reposar 1 hora"), in seconds. */
export type StepTimer = { label: string; seconds: number };

const UNIT_SECONDS: [RegExp, number][] = [
  [/^h(ora|oras)?$/, 3600],
  [/^min(uto|utos)?$/, 60],
  [/^seg(undo|undos)?$/, 1],
];

/**
 * The times mentioned in a step: "20 minutos", "1 hora", "10-15 min" (the longer one counts,
 * so it never rings early), "1 hora y media". Each one becomes a timer the cook can start.
 */
export function findStepTimers(text: string): StepTimer[] {
  const found: StepTimer[] = [];
  const pattern = /(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|a|o)\s*(\d+(?:[.,]\d+)?))?\s*(horas?|h|minutos?|min|segundos?|seg)\b(\s+y\s+media)?/gi;
  for (const match of text.matchAll(pattern)) {
    const amount = Number((match[2] ?? match[1]).replace(",", "."));
    const unit = match[3].toLowerCase();
    const seconds = UNIT_SECONDS.find(([regex]) => regex.test(unit))?.[1];
    if (!seconds || !Number.isFinite(amount) || amount <= 0) continue;
    const total = Math.round(amount * seconds + (match[4] ? seconds / 2 : 0));
    if (total < 5 || total > 24 * 3600) continue;
    if (found.some((timer) => timer.seconds === total)) continue;
    found.push({ label: match[0].trim(), seconds: total });
  }
  return found;
}

export function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
