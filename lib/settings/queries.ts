import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_MENU_PREFERENCES,
  parseMenuPreferences,
  type MenuPreferences,
} from "@/lib/menu/preferences";

/** The user's menu preferences; the old fixed behaviour until they choose. */
export async function getMenuPreferences(): Promise<MenuPreferences> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("menu_preferences")
    .maybeSingle();
  if (error) {
    // A missing settings table must not stop the menu from working.
    console.error("[settings] could not read menu preferences:", error.message);
    return DEFAULT_MENU_PREFERENCES;
  }
  return parseMenuPreferences(data?.menu_preferences);
}

/** The staples the user always has: they never go in the shopping list. */
export async function getPantry(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_settings").select("pantry").maybeSingle();
  if (error) {
    console.error("[settings] could not read the pantry:", error.message);
    return [];
  }
  return ((data?.pantry as string[] | undefined) ?? []).filter(Boolean);
}
