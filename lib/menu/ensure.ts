import "server-only";
import type { requireUser } from "@/lib/auth-server";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** Finds the week's menu, creating it on first use. */
export async function ensureMenu(supabase: Supabase, weekStart: string) {
  const find = () =>
    supabase.from("menus").select("id").eq("week_start", weekStart).maybeSingle();

  const existing = await find();
  if (existing.error) return null;
  if (existing.data) return existing.data.id as string;

  const created = await supabase.from("menus").insert({ week_start: weekStart }).select("id").single();
  if (!created.error) return created.data.id as string;
  // Lost a race with another request creating the same week.
  const retry = await find();
  return (retry.data?.id as string | undefined) ?? null;
}
