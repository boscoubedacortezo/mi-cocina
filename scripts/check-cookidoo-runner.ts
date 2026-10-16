/** Runs the console script and the bookmarklet against a fake Cookidoo and checks the calls. */
import vm from "node:vm";
import { buildCookidooRecipe, type CookidooRecipe } from "@/lib/cookidoo/payload";
import { buildBookmarklet, buildRunnerScript, serializeRecipe } from "@/lib/cookidoo/runner";

const recipe: CookidooRecipe = buildCookidooRecipe({
  title: "Prueba",
  servings: 4,
  prepMinutes: 10,
  totalMinutes: 30,
  ingredientsText: "200 g de arroz\n1 cebolla",
  steps: [
    { text: "Cocer.", time_seconds: 600, temperature: 100, speed: "cuchara", reverse: true, accessory: null, mode: null },
  ],
});

async function run(code: string, extra: Record<string, unknown>, failAt?: string) {
  const calls: string[] = [];
  const alerts: string[] = [];
  const location = { hostname: "cookidoo.es", href: "" };
  const fetchMock = async (url: string, init: { method: string; body: string }) => {
    const key = `${init.method} ${url}`;
    calls.push(`${key} ${Object.keys(JSON.parse(init.body))[0]}`);
    const reject = failAt !== undefined && init.body.includes(failAt);
    const body = init.method === "POST" ? { recipeId: "ID1" } : {};
    return { ok: !reject, status: reject ? 400 : 200, text: async () => JSON.stringify(body) };
  };
  const context = vm.createContext({
    fetch: fetchMock, alert: (m: string) => alerts.push(m), console, location, JSON, ...extra,
  });
  await vm.runInContext(code, context);
  return { calls, alerts, href: location.href };
}

let failed = 0;
const expect = (name: string, ok: boolean, detail?: unknown) => {
  if (!ok) failed++;
  console.log(ok ? "ok  " : "FAIL", name, ok ? "" : JSON.stringify(detail));
};

async function main() {
  const script = await run(buildRunnerScript(recipe), {});
  expect("console script: POST then 3 PATCH + tools, opens editor",
    script.calls.join("|") ===
      "POST /created-recipes/es-ES recipeName|PATCH /created-recipes/es-ES/ID1 totalTime|PATCH /created-recipes/es-ES/ID1 ingredients|PATCH /created-recipes/es-ES/ID1 instructions|PATCH /created-recipes/es-ES/ID1 tools" &&
    script.href === "/created-recipes/es-ES/ID1/edit" && script.alerts.length === 0, script);

  const bookmarklet = buildBookmarklet();
  expect("bookmarklet is a single line", !bookmarklet.includes("\n") && bookmarklet.startsWith("javascript:"));

  const clipboard = { readText: async () => serializeRecipe(recipe) };
  const viaClipboard = await run(bookmarklet.slice("javascript:".length), { navigator: { clipboard } });
  expect("bookmarklet reads the clipboard and sends", viaClipboard.href === "/created-recipes/es-ES/ID1/edit" && viaClipboard.calls.length === 5, viaClipboard);

  const refused = { readText: async () => { throw new Error("denied"); } };
  const viaPrompt = await run(bookmarklet.slice("javascript:".length), {
    navigator: { clipboard: refused }, prompt: () => serializeRecipe(recipe),
  });
  expect("bookmarklet falls back to a prompt", viaPrompt.calls.length === 5, viaPrompt);

  const junk = await run(bookmarklet.slice("javascript:".length), { navigator: { clipboard: { readText: async () => "hola" } } });
  expect("bookmarklet rejects other clipboard text", junk.calls.length === 0 && junk.alerts.length === 1, junk);

  const failing = await run(buildRunnerScript(recipe), {}, "ingredients");
  expect("a rejected PATCH stops and says which", failing.alerts.length === 1 && failing.alerts[0].includes("ingredients") && failing.href === "", failing);

  // The icons must survive: the serialised text has no raw private-use character.
  expect("serialised recipe is ASCII", /^[\x20-\x7e]*$/.test(serializeRecipe(recipe)));
  process.exit(failed ? 1 : 0);
}
main();
