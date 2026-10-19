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

async function run(
  code: string,
  extra: Record<string, unknown>,
  failAt?: string,
  cloudinaryFails = false,
  listing: { titles: string[]; confirmAnswer?: boolean; listingFails?: boolean } = { titles: [] },
) {
  const calls: string[] = [];
  const patches: { url: string; body: Record<string, unknown> }[] = [];
  const alerts: string[] = [];
  const location = { hostname: "cookidoo.es", href: "" };
  const confirms: string[] = [];
  const fetchMock = async (url: string, init: { method?: string; body?: string | FormData }) => {
    if (init.method === undefined) {
      calls.push(`GET ${url}`);
      if (listing.listingFails) throw new Error("network");
      return { ok: true, status: 200, text: async () => listing.titles.join("|") };
    }
    if (url.startsWith("https://api-eu.cloudinary.com/")) {
      const form = init.body as FormData;
      calls.push(`CLOUDINARY ${[...form.keys()].sort().join(",")}`);
      if (cloudinaryFails) return { ok: false, status: 400, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ public_id: "prod/img/customer-recipe/abc", format: "jpg" }) };
    }
    if (typeof init.body !== "string") throw new Error("unexpected body");
    patches.push({ url, body: JSON.parse(init.body) });
    const key = `${init.method} ${url}`;
    calls.push(`${key} ${Object.keys(JSON.parse(init.body))[0]}`);
    const reject = failAt !== undefined && init.body.includes(failAt);
    const body = url.endsWith("/image/signature") ? { signature: "sig" } : init.method === "POST" ? { recipeId: "ID1" } : {};
    return { ok: !reject, status: reject ? 400 : 200, text: async () => JSON.stringify(body) };
  };
  const context = vm.createContext({
    fetch: fetchMock, alert: (m: string) => alerts.push(m), console, location, JSON, atob, Blob, FormData, Uint8Array, Math, Date, Boolean, String, Error,
    createImageBitmap: async () => ({ width: 640, height: 480 }),
    DOMParser: class {
      parseFromString(text: string) {
        const leaves = text ? text.split("|").map((t) => ({ children: [], textContent: t })) : [];
        return { querySelectorAll: () => leaves };
      }
    },
    confirm: (m: string) => (confirms.push(m), listing.confirmAnswer ?? true),
    ...extra,
  });
  await vm.runInContext(code, context);
  return { calls, alerts, href: location.href, patches, confirms };
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
      "GET /created-recipes/es-ES|POST /created-recipes/es-ES recipeName|PATCH /created-recipes/es-ES/ID1 totalTime|PATCH /created-recipes/es-ES/ID1 ingredients|PATCH /created-recipes/es-ES/ID1 instructions|PATCH /created-recipes/es-ES/ID1 tools" &&
    script.href === "/created-recipes/es-ES/ID1/edit" && script.alerts.length === 0, script);

  const bookmarklet = buildBookmarklet();
  expect("bookmarklet is a single line", !bookmarklet.includes("\n") && bookmarklet.startsWith("javascript:"));

  const clipboard = { readText: async () => serializeRecipe(recipe) };
  const viaClipboard = await run(bookmarklet.slice("javascript:".length), { navigator: { clipboard } });
  expect("bookmarklet reads the clipboard and sends", viaClipboard.href === "/created-recipes/es-ES/ID1/edit" && viaClipboard.calls.length === 6, viaClipboard);

  const refused = { readText: async () => { throw new Error("denied"); } };
  const viaPrompt = await run(bookmarklet.slice("javascript:".length), {
    navigator: { clipboard: refused }, prompt: () => serializeRecipe(recipe),
  });
  expect("bookmarklet falls back to a prompt", viaPrompt.calls.length === 6, viaPrompt);

  const junk = await run(bookmarklet.slice("javascript:".length), { navigator: { clipboard: { readText: async () => "hola" } } });
  expect("bookmarklet rejects other clipboard text", junk.calls.length === 0 && junk.alerts.length === 1, junk);

  const failing = await run(buildRunnerScript(recipe), {}, "ingredients");
  expect("a rejected PATCH stops and says which", failing.alerts.length === 1 && failing.alerts[0].includes("ingredients") && failing.href === "", failing);

  // The photo: signature from Cookidoo, upload to Cloudinary, then link it.
  const photo = { data: Buffer.from("fake-jpeg-bytes").toString("base64"), type: "image/jpeg", owned: false };
  const withPhoto = await run(buildRunnerScript({ ...recipe, photo }), {});
  const link = withPhoto.patches.find((p) => "image" in p.body);
  const signature = withPhoto.patches.find((p) => p.url.endsWith("/image/signature"));
  expect("photo: sign, upload, link, then open the editor",
    withPhoto.calls.slice(-3).join("|") ===
      "POST /created-recipes/es-ES/image/signature timestamp|CLOUDINARY api_key,custom_coordinates,file,signature,source,timestamp,upload_preset|PATCH /created-recipes/es-ES/ID1 image" &&
    withPhoto.href === "/created-recipes/es-ES/ID1/edit" && withPhoto.alerts.length === 0, withPhoto);
  expect("photo: linked as in the editor", JSON.stringify(link?.body) === '{"image":"prod/img/customer-recipe/abc.jpg","isImageOwnedByUser":false}', link);
  expect("photo: signature body as in the editor",
    JSON.stringify(Object.keys(signature?.body ?? {})) === '["timestamp","source","custom_coordinates"]' && signature?.body.custom_coordinates === "0,0,640,480", signature);
  const owned = await run(buildRunnerScript({ ...recipe, photo: { ...photo, owned: true } }), {});
  expect("photo: owned flag is sent only when set", owned.patches.find((p) => "image" in p.body)?.body.isImageOwnedByUser === true);
  const noPhoto = await run(buildRunnerScript(recipe), {});
  expect("no photo: nothing about images is called", !noPhoto.calls.some((c) => c.includes("image") || c.startsWith("CLOUDINARY")));
  const broken = await run(buildRunnerScript({ ...recipe, photo }), {}, undefined, true);
  expect("photo failure: recipe stays, user is told, editor still opens",
    broken.alerts.length === 1 && broken.alerts[0].includes("foto") && broken.href === "/created-recipes/es-ES/ID1/edit", broken);

  // Duplicates: the title is looked up in the user's list before creating anything.
  const dup = await run(buildRunnerScript(recipe), {}, undefined, false, { titles: ["Otra", "  PRUEBA "], confirmAnswer: false });
  expect("duplicate, user says no: asks and creates nothing",
    dup.confirms.length === 1 && dup.confirms[0].includes("Prueba") && !dup.calls.some((c) => c.startsWith("POST")) && dup.href === "", dup);
  const dupYes = await run(buildRunnerScript(recipe), {}, undefined, false, { titles: ["prueba"], confirmAnswer: true });
  expect("duplicate, user says yes: creates it", dupYes.confirms.length === 1 && dupYes.href === "/created-recipes/es-ES/ID1/edit", dupYes);
  const fresh = await run(buildRunnerScript(recipe), {}, undefined, false, { titles: ["Otra receta", "Prueba de algo"] });
  expect("no exact match (a longer title does not count): no question", fresh.confirms.length === 0 && fresh.href !== "", fresh);
  const unreadable = await run(buildRunnerScript(recipe), {}, undefined, false, { titles: [], listingFails: true });
  expect("unreadable list: carries on without asking", unreadable.confirms.length === 0 && unreadable.href === "/created-recipes/es-ES/ID1/edit", unreadable);
  const viaBookmarklet = await run(buildBookmarklet().slice("javascript:".length), { navigator: { clipboard: { readText: async () => serializeRecipe(recipe) } } }, undefined, false, { titles: ["Prueba"], confirmAnswer: false });
  expect("bookmarklet asks too", viaBookmarklet.confirms.length === 1 && viaBookmarklet.href === "", viaBookmarklet);

  // The icons must survive: the serialised text has no raw private-use character.
  expect("serialised recipe is ASCII", /^[\x20-\x7e]*$/.test(serializeRecipe(recipe)));
  process.exit(failed ? 1 : 0);
}
main();
