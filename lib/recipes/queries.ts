import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { isCookidooUrl } from "./cookidoo-url";
import { parseQuery, searchScore } from "./search";
import { createClient } from "@/lib/supabase/server";
import {
  COURSE_LABELS,
  MAIN_INGREDIENT_LABELS,
  RECIPE_IMAGES_BUCKET,
  THERMOMIX_FILTER,
  type Course,
  type Equipment,
  type MainIngredient,
  type ShopSection,
  type SourceType,
  type Unit,
} from "./constants";
import { TM_BOWL_ML } from "@/lib/thermomix/constants";
import { recipeOrigin, type Origin } from "./origin";

export type RecipeSummary = {
  id: string;
  title: string;
  tags: string[];
  course: Course | null;
  main_ingredient: MainIngredient | null;
  /** How it is cooked, besides the Thermomix (which is derived, see below). */
  equipment: Equipment[];
  prep_minutes: number | null;
  cook_minutes: number | null;
  image_path: string | null;
  image_url: string | null;
  /** True when the recipe has a Thermomix version. */
  has_thermomix: boolean;
  /** Imported from a Cookidoo link: it is cooked in Cookidoo, so it has no steps here. */
  from_cookidoo: boolean;
  /** Its Thermomix version does not fit in the bowl with the servings it has. */
  thermomix_overflow: boolean;
  /** Where it comes from (Cookidoo, Instagram, a website, typed by hand...). */
  origin: Origin;
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
  equipment: Equipment[];
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

/** A row of the list query; the last three columns only come when searching. */
type ListRow = {
  id: string;
  title: string;
  tags: string[];
  course: Course | null;
  main_ingredient: MainIngredient | null;
  equipment: Equipment[] | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  image_path: string | null;
  source_type: SourceType;
  source_url: string | null;
  description?: string | null;
  notes?: string | null;
  recipe_ingredients?: { name: string }[];
  thermomix_versions: { id: string; capacity: { peak_ml?: number } | null }[];
};

export async function listRecipes(filters: {
  q?: string;
  tag?: string;
  course?: Course;
  main?: MainIngredient;
  /** "thermomix" (own version or from Cookidoo) or one of the other ways of cooking. */
  cocina?: typeof THERMOMIX_FILTER | Equipment;
  /** Only recipes from this origin. */
  origen?: Origin;
}) {
  const supabase = await createClient();
  const tokens = parseQuery(filters.q ?? "");
  // Text is only matched in code (accents, word order and ranking are easier to get
  // right there), so the extra columns are loaded only when someone is searching.
  const searching = tokens.length > 0;
  const columns = [
    "id",
    "title",
    "tags",
    "course",
    "main_ingredient",
    "equipment",
    "prep_minutes",
    "cook_minutes",
    "image_path",
    "source_type",
    "source_url",
    ...(searching ? ["description", "notes", "recipe_ingredients(name)"] : []),
    "thermomix_versions(id, capacity)",
  ].join(", ");
  let query = supabase
    .from("recipes")
    .select(columns)
    .order("created_at", { ascending: false });

  if (filters.tag) query = query.contains("tags", [filters.tag]);
  if (filters.course) query = query.eq("course", filters.course);
  if (filters.main) query = query.eq("main_ingredient", filters.main);
  if (filters.cocina && filters.cocina !== THERMOMIX_FILTER) {
    query = query.contains("equipment", [filters.cocina]);
  }

  const { data: rows, error } = await query;
  if (error) throw new Error("No se pudieron cargar las recetas.");
  const data = rows as unknown as ListRow[];

  // Keep the matches, best first (ties keep the newest-first order of the query).
  const ranked = data
    .map((row, index) => {
      if (!searching) return { row, score: 0, index };
      const score = searchScore(
        {
          title: row.title,
          description: row.description,
          notes: row.notes,
          tags: row.tags,
          labels: [
            ...(row.course ? [COURSE_LABELS[row.course]] : []),
            ...(row.main_ingredient ? [MAIN_INGREDIENT_LABELS[row.main_ingredient]] : []),
          ],
          ingredients: row.recipe_ingredients?.map((i) => i.name) ?? [],
        },
        tokens,
      );
      return { row, score, index };
    })
    .filter((item): item is { row: (typeof data)[number]; score: number; index: number } => item.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.row);

  const urls = await signImageUrls(
    ranked.flatMap((recipe) => (recipe.image_path ? [recipe.image_path] : [])),
  );
  const recipes = ranked.map<RecipeSummary>((row) => ({
    id: row.id,
    title: row.title,
    tags: row.tags,
    course: row.course,
    main_ingredient: row.main_ingredient,
    equipment: row.equipment ?? [],
    prep_minutes: row.prep_minutes,
    cook_minutes: row.cook_minutes,
    image_path: row.image_path,
    image_url: row.image_path ? (urls.get(row.image_path) ?? null) : null,
    has_thermomix: Array.isArray(row.thermomix_versions) && row.thermomix_versions.length > 0,
    from_cookidoo: isCookidooUrl(row.source_url),
    thermomix_overflow:
      Array.isArray(row.thermomix_versions) &&
      row.thermomix_versions.some((version) => (version.capacity?.peak_ml ?? 0) > TM_BOWL_ML),
    origin: recipeOrigin(row.source_type, row.source_url),
  }));
  // Decided here, with the same rules that draw the card, instead of URL patterns in SQL.
  return recipes.filter(
    (recipe) =>
      (!filters.origen || recipe.origin === filters.origen) &&
      (filters.cocina !== THERMOMIX_FILTER || recipe.has_thermomix || recipe.from_cookidoo),
  );
}

/** What the list filters can offer: only values that at least one recipe has. */
export async function listFacets() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("tags, course, main_ingredient, equipment, source_type, source_url, thermomix_versions(id)");
  if (error) throw new Error("No se pudieron cargar los filtros.");

  const courses = new Set<Course>();
  const mains = new Set<MainIngredient>();
  const tagCounts = new Map<string, number>();
  const equipment = new Set<Equipment>();
  let hasThermomix = false;
  const origins = new Set<Origin>();
  for (const row of data) {
    origins.add(recipeOrigin(row.source_type as SourceType, row.source_url));
    if (Array.isArray(row.thermomix_versions) && row.thermomix_versions.length > 0) hasThermomix = true;
    if (isCookidooUrl(row.source_url)) {
      hasThermomix = true; // from Cookidoo means cooked in the Thermomix
    }
    for (const item of (row.equipment ?? []) as Equipment[]) equipment.add(item);
    if (row.course) courses.add(row.course);
    if (row.main_ingredient) mains.add(row.main_ingredient);
    for (const tag of row.tags as string[]) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  return {
    courses,
    mains,
    equipment,
    hasThermomix,
    origins,
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
    equipment: r.equipment ?? [],
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
