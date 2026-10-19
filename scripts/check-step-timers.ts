import { findStepTimers, formatClock } from "@/lib/recipes/step-timers";
let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { failed++; console.log("FAIL", name, JSON.stringify(got), "!=", JSON.stringify(want)); }
};
const secs = (text: string) => findStepTimers(text).map((t) => t.seconds);
eq("minutes", secs("Hornea 20 minutos a 180 °C."), [1200]);
eq("range uses the longer", secs("Cuece de 10 a 15 min."), [900]);
eq("dash range", secs("Reposa 10-15 minutos"), [900]);
eq("hour", secs("Deja reposar 1 hora"), [3600]);
eq("hour and a half", secs("Cuece 1 hora y media"), [5400]);
eq("seconds", secs("Dora 30 segundos por cada lado"), [30]);
eq("two times", secs("Sofríe 5 minutos y luego hornea 25 minutos"), [300, 1500]);
eq("same time once", secs("Fríe 3 minutos, da la vuelta y 3 minutos más"), [180]);
eq("decimal", secs("Cuece 2,5 minutos"), [150]);
eq("no time", secs("Mezcla los 200 g de harina con 2 huevos."), []);
eq("temperature is not a time", secs("Calienta a 100 grados"), []);
eq("clock", [formatClock(75), formatClock(3725)], ["01:15", "1:02:05"]);
console.log(failed ? `${failed} failed` : "all ok");
process.exit(failed ? 1 : 0);
