/**
 * One-off: gives the recipes imported from Instagram, TikTok or YouTube the cover of their
 * video as photo. It only touches recipes with no photo, unless --replace is given.
 *
 *   npx tsx --conditions react-server --env-file=.env.local scripts/backfill-covers.ts          # shows what it would do
 *   npx tsx --conditions react-server --env-file=.env.local scripts/backfill-covers.ts --apply  # writes it
 *
 * --replace   also redo recipes that already have a photo (use it with --only)
 * --only=text only the recipes whose title contains the text
 *
 * Uses the service-role key (bypasses RLS): run it on your own machine only.
 */
import { createClient } from "@supabase/supabase-js";
import { fetchPublicImage } from "@/lib/ai/safe-fetch";
import { loadWebSource } from "@/lib/ai/web-source";
import { RECIPE_IMAGES_BUCKET } from "@/lib/recipes/constants";
import { isSocialImageHost, socialPlatform } from "@/lib/recipes/social-url";

const apply = process.argv.includes("--apply");
const replace = process.argv.includes("--replace");
const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice("--only=".length).toLowerCase();

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase
    .from("recipes")
    .select("id, user_id, title, source_url, image_path")
    .not("source_url", "is", null);
  if (error) throw new Error(`No se pudieron leer las recetas: ${error.message}`);

  const candidates = data.filter(
    (recipe) =>
      socialPlatform(recipe.source_url) &&
      (replace || recipe.image_path === null) &&
      (!only || recipe.title.toLowerCase().includes(only)),
  );
  console.log(
    `${apply ? "Escribiendo cambios." : "Simulación: no se escribe nada."} ` +
      `${candidates.length} receta(s) de redes sociales${replace ? "" : " sin foto"}.\n`,
  );

  for (const recipe of candidates) {
    const label = `${socialPlatform(recipe.source_url)} · ${recipe.title}`;
    try {
      const source = await loadWebSource(recipe.source_url!);
      if (!source.imageUrl) {
        console.log(`-  ${label}: la página no da portada.`);
        continue;
      }
      if (!apply) {
        const image = await fetchPublicImage(source.imageUrl, isSocialImageHost);
        console.log(`ok ${label}: portada disponible (${image.contentType}, ${Math.round(image.bytes.byteLength / 1024)} KB).`);
        continue;
      }
      const image = await fetchPublicImage(source.imageUrl, isSocialImageHost);
      const path = `${recipe.user_id}/${crypto.randomUUID()}.${image.ext}`;
      const { error: uploadError } = await supabase.storage
        .from(RECIPE_IMAGES_BUCKET)
        .upload(path, image.bytes, { contentType: image.contentType });
      if (uploadError) {
        console.log(`!! ${label}: no se pudo subir (${uploadError.message}).`);
        continue;
      }
      const { error: updateError } = await supabase
        .from("recipes")
        .update({ image_path: path })
        .eq("id", recipe.id);
      if (updateError) {
        await supabase.storage.from(RECIPE_IMAGES_BUCKET).remove([path]);
        console.log(`!! ${label}: ${updateError.message}`);
        continue;
      }
      // The photo it replaces is no longer used by anything.
      if (recipe.image_path) await supabase.storage.from(RECIPE_IMAGES_BUCKET).remove([recipe.image_path]);
      console.log(`ok ${label}: foto guardada.`);
    } catch (e) {
      console.log(`!! ${label}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
