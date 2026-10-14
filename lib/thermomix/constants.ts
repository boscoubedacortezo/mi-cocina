export const TM_SPEEDS = [
  "cuchara",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "turbo",
] as const;
export type TmSpeed = (typeof TM_SPEEDS)[number];

/** Temperatures in °C; "Varoma" is handled separately. */
export const TM_TEMPERATURES = [
  37, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 98, 100, 105, 110, 115, 120,
] as const;

export const TM_ACCESSORIES = ["mariposa", "cestillo", "varoma"] as const;
export type TmAccessory = (typeof TM_ACCESSORIES)[number];

/** The TM7 timer stops at 99 minutes. */
export const TM_MAX_SECONDS = 99 * 60;

/** The butterfly whisk is only safe up to speed 4. */
export const TM_BUTTERFLY_MAX_SPEED = 4;

/**
 * Cookidoo preset modes that cannot be inferred from the other settings.
 * Turbo, Triturar and Calentar are derived from them (see helix.ts).
 */
export const TM_MODES = ["amasar", "arroz"] as const;
export type TmMode = (typeof TM_MODES)[number];

export const TM_MODE_LABELS: Record<TmMode, string> = {
  amasar: "Amasar",
  arroz: "Cocción de arroz",
};
