import type { ThermomixStep } from "./schema";

export type HelixPlan = { tab: string; fields: [string, string][] };

const SPEEDS_IN_TRITURAR = ["6", "7", "8"];
const SPEEDS_IN_CALENTAR = ["cuchara", "1", "2"];

/**
 * Where to enter a step's machine settings in Cookidoo's "Añadir configuración"
 * dialog: one of the preset modes when the step fits it exactly, else "Manual".
 */
export function helixPlan(step: ThermomixStep): HelixPlan {
  const { time_seconds: time, temperature, speed } = step;
  const plain = !step.reverse && !step.accessory;

  if (speed === "turbo" && temperature === null && time !== null && time <= 2 && plain) {
    return { tab: "Modos › Turbo", fields: [["Duración", `${time} seg`]] };
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
        ["Temperatura", `${temperature} °C`],
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
    fields.push(["Temperatura", temperature === "Varoma" ? "Varoma" : `${temperature} °C`]);
  }
  if (speed) fields.push(["Velocidad", speed === "turbo" ? "Turbo" : speed]);
  if (step.reverse) fields.push(["Giro", "Inverso"]);
  if (step.accessory) fields.push(["Accesorio", step.accessory]);
  return { tab: "Manual", fields };
}
