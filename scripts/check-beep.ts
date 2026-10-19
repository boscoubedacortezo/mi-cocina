import { beepWavBytes } from "@/lib/beep";
const bytes = beepWavBytes(3);
const view = new DataView(bytes.buffer);
const tag = (o: number) => String.fromCharCode(...bytes.subarray(o, o + 4));
const checks: [string, boolean][] = [
  ["RIFF/WAVE/fmt/data tags", tag(0) === "RIFF" && tag(8) === "WAVE" && tag(12) === "fmt " && tag(36) === "data"],
  ["PCM mono 16 bit 22050", view.getUint16(20, true) === 1 && view.getUint16(22, true) === 1 && view.getUint32(24, true) === 22050 && view.getUint16(34, true) === 16],
  ["sizes agree", view.getUint32(40, true) === bytes.length - 44 && view.getUint32(4, true) === bytes.length - 8],
  ["about 1.1 s long", Math.abs((bytes.length - 44) / 2 / 22050 - 1.14) < 0.05],
  ["not silent", [...new Int16Array(bytes.buffer.slice(44))].some((v) => Math.abs(v) > 5000)],
];
for (const [name, ok] of checks) console.log(ok ? "ok  " : "FAIL", name);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
