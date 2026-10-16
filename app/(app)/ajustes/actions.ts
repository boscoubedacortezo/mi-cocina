"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-server";
import { menuPreferencesSchema } from "@/lib/menu/preferences";

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
