"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-server";
import { z } from "zod";
import { menuPreferencesSchema } from "@/lib/menu/preferences";
import { pantryKey } from "@/lib/shopping/pantry";
import { getPantry } from "@/lib/settings/queries";

export type SettingsResult = { ok: true } | { ok: false; error: string };

export async function saveMenuPreferences(input: unknown): Promise<SettingsResult> {
  const { supabase, userId } = await requireUser();
  const parsed = menuPreferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, menu_preferences: parsed.data }, { onConflict: "user_id" });
  if (error) return { ok: false, error: "No se pudieron guardar las preferencias." };

  revalidatePath("/ajustes");
  revalidatePath("/menu");
  return { ok: true };
}

const pantryNameSchema = z.string().trim().min(1, "Escribe un ingrediente.").max(60);
const MAX_PANTRY = 150;

async function savePantry(pantry: string[]): Promise<SettingsResult> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, pantry }, { onConflict: "user_id" });
  if (error) return { ok: false, error: "No se pudo guardar la despensa." };
  revalidatePath("/ajustes");
  revalidatePath("/compra");
  return { ok: true };
}

/** Adds a staple to the pantry: it stops appearing in the shopping list. */
export async function addToPantry(name: unknown): Promise<SettingsResult> {
  await requireUser();
  const parsed = pantryNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const key = pantryKey(parsed.data);
  if (!key) return { ok: false, error: "Escribe un ingrediente." };

  const current = await getPantry();
  if (current.includes(key)) return { ok: true };
  if (current.length >= MAX_PANTRY) return { ok: false, error: "La despensa está llena." };
  return savePantry([...current, key].sort((a, b) => a.localeCompare(b, "es")));
}

export async function removeFromPantry(name: unknown): Promise<SettingsResult> {
  await requireUser();
  const parsed = pantryNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const key = pantryKey(parsed.data);
  return savePantry((await getPantry()).filter((entry) => entry !== key));
}
