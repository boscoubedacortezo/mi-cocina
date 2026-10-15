import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  RECIPE_IMAGES_BUCKET,
  type Course,
  type MainIngredient,
  type ShopSection,
  type SourceType,
  type Unit,
} from "./constants";

export type RecipeSummary = {
  id: string;
  title: string;
  tags: string[];
  course: Course | null;
  main_ingredient: MainIngredient | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  image_path: string | null;
  image_url: string | null;
  /** True when the recipe has a Thermomix version. */
  has_thermomix: boolean;
};

export type RecipeDetail = {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  tags: string[];
  course: Course | null;
  main_ingredient: MainIngredient | null;
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

export async function listRecipes(filters: {
  q?: string;
  tag?: string;
  course?: Course;
  main?: MainIngredient;
  /** Only recipes that have a Thermomix version. */
  thermomix?: boolean;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("recipes")
    .select(
      // "!inner" turns the join into a filter: only recipes with at least one version.
      `id, title, tags, course, main_ingredient, prep_minutes, cook_minutes, image_path, thermomix_versions${filters.thermomix ? "!inner" : ""}(id)`,
    )
    .order("created_at", { ascending: false });

  const q = filters.q ? sanitizeSearch(filters.q) : "";
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (filters.tag) query = query.contains("tags", [filters.tag]);
  if (filters.course) query = query.eq("course", filters.course);
  if (filters.main) query = query.eq("main_ingredient", filters.main);

  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar las recetas.");

  const urls = await signImageUrls(
    data.flatMap((recipe) => (recipe.image_path ? [recipe.image_path] : [])),
  );
  return data.map<RecipeSummary>(({ thermomix_versions, ...recipe }) => ({
    ...recipe,
    image_url: recipe.image_path ? (urls.get(recipe.image_path) ?? null) : null,
    has_thermomix: Array.isArray(thermomix_versions) && thermomix_versions.length > 0,
  }));
}

/** What the list filters can offer: only values that at least one recipe has. */
export async function listFacets() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("tags, course, main_ingredient, thermomix_versions(id)");
  if (error) throw new Error("No se pudieron cargar los filtros.");

  const courses = new Set<Course>();
  const mains = new Set<MainIngredient>();
  const tagCounts = new Map<string, number>();
  let hasThermomix = false;
  for (const row of data) {
    if (Array.isArray(row.thermomix_versions) && row.thermomix_versions.length > 0) hasThermomix = true;
    if (row.course) courses.add(row.course);
    if (row.main_ingredient) mains.add(row.main_ingredient);
    for (const tag of row.tags as string[]) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  return {
    courses,
    mains,
    hasThermomix,
    tags: [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
      .map(([tag]) => tag),
  };
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
    course: r.course,
    main_ingredient: r.main_ingredient,
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
