import type { CookidooRecipe } from "./payload";

/*
 * Code that runs inside the user's logged-in cookidoo.es tab: it creates the recipe and
 * fills it the way the editor does, then opens it. Same-origin requests carry the session
 * by themselves; nothing leaves the browser except the calls to Cookidoo.
 */

/** Body shared by the console script and the bookmarklet. Expects `recipe` in scope. */
const CORE = `
  const fail = (message) => { console.error(message); alert(message); };
  const base = "/created-recipes/es-ES";
  const headers = {
    accept: "application/json",
    "content-type": "application/json",
    "x-requested-with": "xmlhttprequest",
  };
  const call = async (method, url, body) => {
    const response = await fetch(url, { method, headers, credentials: "include", body: JSON.stringify(body) });
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) {}
    return { ok: response.ok, status: response.status, data, text };
  };
  const created = await call("POST", base, recipe.create);
  const id = created.data && created.data.recipeId;
  if (!created.ok || !id) { fail("Cookidoo no ha creado la receta (" + created.status + "). " + created.text.slice(0, 200)); return; }
  for (const patch of recipe.patches) {
    const result = await call("PATCH", base + "/" + id, patch);
    if (!result.ok) { fail("Cookidoo rechazó «" + Object.keys(patch)[0] + "» (" + result.status + "). La receta quedó a medias en «Creadas por mí». " + result.text.slice(0, 200)); return; }
  }
  for (const patch of recipe.optionalPatches) {
    await call("PATCH", base + "/" + id, patch);
  }
  location.href = base + "/" + id + "/edit";
`;

/** Non-ASCII as \u escapes so Cookidoo's private-use icons survive copy and paste. */
export function serializeRecipe(recipe: CookidooRecipe) {
  return JSON.stringify(recipe).replace(
    /[^\x20-\x7e]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

/** A script to paste into the browser console on cookidoo.es (logged in). */
export function buildRunnerScript(recipe: CookidooRecipe) {
  return `(async () => {\n  const recipe = ${serializeRecipe(recipe)};${CORE}})();`;
}

/**
 * A bookmarklet for the browser's bookmarks bar: it reads the recipe copied from Mi
 * Cocina (clipboard, or a prompt if the browser refuses) and sends it.
 */
export function buildBookmarklet() {
  const code = `(async () => {
  if (location.hostname !== "cookidoo.es") { alert("Abre primero cookidoo.es con tu sesión iniciada."); return; }
  let raw = "";
  try { raw = await navigator.clipboard.readText(); } catch (e) { raw = prompt("Pega aquí la receta copiada desde Mi Cocina") || ""; }
  let recipe = null;
  try { recipe = JSON.parse(raw); } catch (e) {}
  if (!recipe || !recipe.create || !recipe.patches) { alert("Copia primero la receta desde Mi Cocina («Enviar a Cookidoo»)."); return; }
  ${CORE}
})();`;
  // One line: bookmarks do not keep line breaks.
  return `javascript:${code.replace(/\n\s*/g, " ")}`;
}
