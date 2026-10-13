import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { RECIPE_IMAGES_BUCKET, type ShopSection, type SourceType, type Unit } from "./constants";

export type RecipeSummary = {
  id: string;
  title: string;
  tags: string[];
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  image_path: string | null;
  image_url: string | null;
};

export type RecipeDetail = {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  tags: string[];
  source_type: SourceType;
  source_url: string | null;
  image_path: string | null;
  image_url: string | null;
  notes: string | null;
  ingredients: {
    id: string;
    name: string;
    quantity: number | null;
    unit: Unit | null;
    shop_section: ShopSection;
    optional: boolean;
  }[];
  steps: { id: string; text: string }[];
};

const SIGNED_URL_SECONDS = 60 * 60;

async function signImageUrls(paths: string[]) {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(RECIPE_IMAGES_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

// PostgREST filter values break on these characters; LIKE wildcards are
// stripped so the search stays a plain "contains".
function sanitizeSearch(term: string) {
  return term.replace(/[,()%_\\*]/g, " ").replace(/\s+/g, " ").trim();
}

export async function listRecipes(filters: { q?: string; tag?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("recipes")
    .select("id, title, tags, servings, prep_minutes, cook_minutes, image_path")
    .order("created_at", { ascending: false });

  const q = filters.q ? sanitizeSearch(filters.q) : "";
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (filters.tag) query = query.contains("tags", [filters.tag]);

  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar las recetas.");

  const urls = await signImageUrls(
    data.flatMap((recipe) => (recipe.image_path ? [recipe.image_path] : [])),
  );
  return data.map<RecipeSummary>((recipe) => ({
    ...recipe,
    image_url: recipe.image_path ? (urls.get(recipe.image_path) ?? null) : null,
  }));
}

export async function listAllTags() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").select("tags");
  if (error) throw new Error("No se pudieron cargar las etiquetas.");
  const counts = new Map<string, number>();
  for (const { tags } of data) {
    for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .map(([tag]) => tag);
}

export const getRecipe = cache(async (id: string): Promise<RecipeDetail> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [recipe, ingredients, steps] = await Promise.all([
    supabase.from("recipes").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("recipe_ingredients")
      .select("id, name, quantity, unit, shop_section, optional")
      .eq("recipe_id", id)
      .order("position"),
    supabase
      .from("recipe_steps")
      .select("id, text")
      .eq("recipe_id", id)
      .order("position"),
  ]);

  if (recipe.error || ingredients.error || steps.error) {
    throw new Error("No se pudo cargar la receta.");
  }
  if (!recipe.data) notFound();

  const urls = await signImageUrls(
    recipe.data.image_path ? [recipe.data.image_path] : [],
  );
  const r = recipe.data;
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    servings: r.servings,
    prep_minutes: r.prep_minutes,
    cook_minutes: r.cook_minutes,
    tags: r.tags,
    source_type: r.source_type,
    source_url: r.source_url,
    image_path: r.image_path,
    image_url: r.image_path ? (urls.get(r.image_path) ?? null) : null,
    notes: r.notes,
    ingredients: ingredients.data.map((item) => ({
      ...item,
      quantity: item.quantity === null ? null : Number(item.quantity),
    })),
    steps: steps.data,
  };
});
