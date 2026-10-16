/** Checks the generated step settings against what Cookidoo's editor was seen sending. */
import { buildSetting } from "@/lib/cookidoo/payload";
import type { ThermomixStep } from "@/lib/thermomix/schema";

const base: ThermomixStep = {
  text: "x",
  time_seconds: null,
  temperature: null,
  speed: null,
  reverse: false,
  accessory: null,
  mode: null,
};

const cases: { name: string; step: Partial<ThermomixStep>; text: string; data: unknown; type: string; modeName?: string }[] = [
  { name: "TTS normal", step: { time_seconds: 90, temperature: 120, speed: "5" }, type: "TTS",
    text: "1 min 30 seg/120°C/velocidad 5",
    data: { speed: "5", time: 90, temperature: { value: "120", unit: "C" } } },
  { name: "TTS varoma", step: { time_seconds: 60, temperature: "Varoma", speed: "1" }, type: "TTS",
    text: "1 min/Varoma/velocidad 1",
    data: { speed: "1", time: 60, temperature: { value: "varoma", unit: "C" } } },
  { name: "TTS reverse + spoon", step: { time_seconds: 600, temperature: 100, speed: "cuchara", reverse: true }, type: "TTS",
    text: "10 min/100°C//velocidad ",
    data: { speed: "soft", direction: "CCW", time: 600, temperature: { value: "100", unit: "C" } } },
  { name: "dough", step: { mode: "amasar", time_seconds: 120 }, type: "MODE", modeName: "dough",
    text: "Amasar /2 min", data: { time: 120 } },
  { name: "turbo", step: { speed: "turbo", time_seconds: 1 }, type: "MODE", modeName: "turbo",
    text: "Turbo /1 seg", data: { time: 1 } },
  { name: "blend", step: { time_seconds: 90, speed: "6" }, type: "MODE", modeName: "blend",
    text: "Triturar /1 min 30 seg", data: { speed: "6", time: 90 } },
  { name: "warm_up", step: { temperature: 65, speed: "cuchara" }, type: "MODE", modeName: "warm_up",
    text: "Calentar /65°C",
    data: { speed: "soft", temperature: { value: "65", unit: "C" } } },
  { name: "rice", step: { mode: "arroz" }, type: "MODE", modeName: "rice_cooker",
    text: "Cocción de arroz ", data: {} },
];

let failed = 0;
for (const c of cases) {
  const got = buildSetting({ ...base, ...c.step });
  const ok =
    got !== null &&
    got.text === c.text &&
    got.type === c.type &&
    got.name === c.modeName &&
    JSON.stringify(got.data) === JSON.stringify(c.data);
  if (!ok) failed++;
  console.log(ok ? "ok  " : "FAIL", c.name, ok ? `(len ${got!.text.length})` : JSON.stringify(got));
}
// Lengths seen in the captures: 30, 24, 26, 14, 13, 23, 15, 18.
const lengths = [30, 24, 26, 14, 13, 23, 15, 18];
cases.forEach((c, i) => {
  if (c.text.length !== lengths[i]) { failed++; console.log("FAIL length", c.name, c.text.length, lengths[i]); }
});
process.exit(failed ? 1 : 0);
