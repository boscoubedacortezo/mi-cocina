import type { CookidooRecipe } from "./payload";

/**
 * A script to paste into the browser console on cookidoo.es (logged in): it creates the
 * recipe and fills it the way the editor does, then opens it. Same-origin requests carry
 * the session by themselves; nothing leaves the browser except the calls to Cookidoo.
 */
export function buildRunnerScript(recipe: CookidooRecipe) {
  // Non-ASCII as \u escapes so the private-use icons survive copy and paste.
  const json = JSON.stringify(recipe).replace(
    /[^\x20-\x7e]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
  return `(async () => {
  const recipe = ${json};
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
  if (!created.ok || !id) { console.error("No se pudo crear la receta", created.status, created.text.slice(0, 300)); return; }
  console.log("Receta creada", id);
  for (const patch of recipe.patches) {
    const result = await call("PATCH", base + "/" + id, patch);
    console.log(Object.keys(patch)[0], result.status);
    if (!result.ok) { console.error("Falló", Object.keys(patch)[0], result.text.slice(0, 300)); return; }
  }
  for (const patch of recipe.optionalPatches) {
    const result = await call("PATCH", base + "/" + id, patch);
    const tools = result.data && result.data.recipeContent ? result.data.recipeContent.tools : result.data && result.data.tools;
    console.log("opcional", Object.keys(patch)[0], result.status, JSON.stringify(tools));
  }
  console.log("Listo. Abriendo la receta…");
  location.href = base + "/" + id + "/edit";
})();`;
}
