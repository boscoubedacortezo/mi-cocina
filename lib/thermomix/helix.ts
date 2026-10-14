import type { ThermomixStep } from "./schema";

export type HelixPlan = { tab: string; fields: [string, string][]; note?: string };

const SPEEDS_IN_TRITURAR = ["6", "7", "8"];
const SPEEDS_IN_CALENTAR = ["cuchara", "1", "2"];

/**
 * Where to enter a step's machine settings in Cookidoo's "Añadir configuración"
 * dialog: one of the preset modes when the step fits it exactly, else "Manual".
 */
export function helixPlan(step: ThermomixStep): HelixPlan {
  const { time_seconds: time, temperature, speed } = step;
  const plain = !step.reverse && !step.accessory;

  // Turbo is a mode, not a manual speed, and only takes 0.5, 1 or 2 seconds.
  if (speed === "turbo") {
    const seconds = Math.min(time ?? 1, 2);
    return {
      tab: "Modos › Turbo",
      fields: [["Duración", `${seconds} seg`]],
      note:
        time !== null && time > 2
          ? "Turbo solo admite 0,5, 1 o 2 seg: repite el pulso las veces que haga falta."
          : undefined,
    };
  }
  if (
    time !== null &&
    temperature === null &&
    speed !== null &&
    SPEEDS_IN_TRITURAR.includes(speed) &&
    plain
  ) {
    return {
      tab: "Modos › Triturar",
      fields: [
        ["Minutos", String(Math.floor(time / 60))],
        ["Segundos", String(time % 60)],
        ["Velocidad", speed],
      ],
    };
  }
  if (
    time === null &&
    typeof temperature === "number" &&
    temperature <= 90 &&
    speed !== null &&
    SPEEDS_IN_CALENTAR.includes(speed) &&
    !step.accessory
  ) {
    return {
      tab: "Modos › Calentar",
      fields: [
        ["Temperatura", `${temperature}°`],
        ["Velocidad", speed],
      ],
    };
  }

  const fields: [string, string][] = [];
  if (time) {
    fields.push(["Minutos", String(Math.floor(time / 60))]);
    fields.push(["Segundos", String(time % 60)]);
  }
  if (temperature !== null) {
    fields.push(["Temperatura", temperature === "Varoma" ? "Varoma" : `${temperature}°`]);
  }
  if (speed) fields.push(["Velocidad", speed === "cuchara" ? "Cuchara" : speed]);
  // Direction is picked inside the speed selector ("Inverso" / "Normal").
  if (step.reverse) fields.push(["Giro", "Inverso"]);
  return {
    tab: "Manual",
    fields,
    note: step.accessory
      ? `Accesorio (${step.accessory}): Cookidoo no tiene campo para él, escríbelo en el texto del paso.`
      : undefined,
  };
}
