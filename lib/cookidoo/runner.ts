import type { CookidooRecipe } from "./payload";

/*
 * Code that runs inside the user's logged-in cookidoo.es tab: it creates the recipe and
 * fills it the way the editor does, then opens it. Same-origin requests carry the session
 * by themselves; nothing leaves the browser except the calls to Cookidoo.
 */

/**
 * Body shared by the console script and the bookmarklet. Expects `recipe` in scope.
 *
 * It must hold no `//` comments: the bookmarklet is squeezed into one line. The photo goes to
 * Cloudinary (Cookidoo's image service) with a signature Cookidoo gives, then gets linked to
 * the recipe; if that fails the recipe stays done, only without its photo.
 */
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
  let photoNote = "";
  if (recipe.photo) {
    try {
      const bytes = Uint8Array.from(atob(recipe.photo.data), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: recipe.photo.type });
      const bitmap = await createImageBitmap(blob);
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = { timestamp, source: "uw", custom_coordinates: "0,0," + bitmap.width + "," + bitmap.height };
      const signed = await call("POST", base + "/image/signature", sign);
      if (!signed.ok || !signed.data || !signed.data.signature) throw new Error("Cookidoo no dio la firma (" + signed.status + ")");
      const form = new FormData();
      form.append("upload_preset", "prod-customer-recipe-signed");
      form.append("source", sign.source);
      form.append("signature", signed.data.signature);
      form.append("timestamp", String(timestamp));
      form.append("api_key", "993585863591145");
      form.append("custom_coordinates", sign.custom_coordinates);
      form.append("file", blob, "receta." + recipe.photo.type.split("/")[1]);
      const upload = await fetch("https://api-eu.cloudinary.com/v1_1/vorwerk-users-gc/image/upload", { method: "POST", body: form });
      const uploaded = await upload.json();
      if (!upload.ok || !uploaded.public_id) throw new Error("el servicio de imágenes la rechazó (" + upload.status + ")");
      const linked = await call("PATCH", base + "/" + id, {
        image: uploaded.public_id + "." + uploaded.format,
        isImageOwnedByUser: Boolean(recipe.photo.owned),
      });
      if (!linked.ok) throw new Error("Cookidoo no la aceptó (" + linked.status + ")");
    } catch (e) {
      photoNote = "La receta está creada, pero la foto no se ha podido subir: " + (e && e.message ? e.message : e);
    }
  }
  if (photoNote) fail(photoNote);
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
