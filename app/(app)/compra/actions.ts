"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth-server";
import { addDays, todayInMadrid } from "@/lib/menu/dates";
import { DEFAULT_RANGE_DAYS, lineSchema, manualItemSchema, rangeSchema } from "@/lib/shopping/schema";

export type ShoppingResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "No se pudo actualizar la lista. Inténtalo de nuevo.";
const fail = (error: string): ShoppingResult => ({ ok: false, error });
const done = (): ShoppingResult => ({ ok: true });

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];
type Range = { start: string; end: string };

/**
 * The user's one list. Created when needed with the range the screen shows;
 * an existing list keeps its dates unless `updateRange` says the user changed them.
 */
async function ensureList(supabase: Supabase, range: Range | undefined, updateRange = false) {
  const { data: existing } = await supabase.from("shopping_lists").select("id").maybeSingle();
  if (existing) {
    if (range && updateRange) {
      const { error } = await supabase
        .from("shopping_lists")
        .update({ start_date: range.start, end_date: range.end })
        .eq("id", existing.id);
      if (error) return null;
    }
    return existing.id as string;
  }
  const start = range?.start ?? todayInMadrid();
  const { data, error } = await supabase
    .from("shopping_lists")
    .insert({ start_date: start, end_date: range?.end ?? addDays(start, DEFAULT_RANGE_DAYS - 1) })
    .select("id")
    .single();
  return error ? null : (data.id as string);
}

/** Changes the period the list covers. The list itself follows the menu on its own. */
export async function setShoppingRange(input: unknown): Promise<ShoppingResult> {
  const { supabase } = await requireUser();
  const range = rangeSchema.safeParse(input);
  if (!range.success) return fail(range.error.issues[0].message);

  if (!(await ensureList(supabase, range.data, true))) return fail(GENERIC_ERROR);

  revalidatePath("/compra");
  return done();
}

const stateSchema = z.object({
  range: rangeSchema,
  item: lineSchema,
  state: z.enum(["pending", "checked", "removed"]),
});

/**
 * Marks a line that comes from the menu: bought, removed ("I already have it"), or
 * back to pending. The quantity needed now is kept with the mark, so if the menu
 * later needs more, the line shows up again.
 */
export async function setLineState(input: unknown): Promise<ShoppingResult> {
  const { supabase } = await requireUser();
  const parsed = stateSchema.safeParse(input);
  if (!parsed.success) return fail("Artículo no válido.");
  const { range, item, state } = parsed.data;

  const listId = await ensureList(supabase, range);
  if (!listId) return fail(GENERIC_ERROR);

  const { error } =
    state === "pending"
      ? await supabase.from("shopping_items").delete().eq("list_id", listId).eq("key", item.key)
      : await supabase.from("shopping_items").upsert(
          {
            list_id: listId,
            key: item.key,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            shop_section: item.shop_section,
            marked_quantity: item.quantity,
            checked: state === "checked",
            excluded: state === "removed",
            is_manual: false,
          },
          { onConflict: "list_id,key" },
        );
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/compra");
  return done();
}

export async function addShoppingItem(input: unknown): Promise<ShoppingResult> {
  const { supabase } = await requireUser();
  const parsed = z.object({ range: rangeSchema, item: manualItemSchema }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const listId = await ensureList(supabase, parsed.data.range);
  if (!listId) return fail(GENERIC_ERROR);

  const { error } = await supabase
    .from("shopping_items")
    .insert({ ...parsed.data.item, list_id: listId, checked: false, is_manual: true });
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/compra");
  return done();
}

export async function toggleManualItem(id: unknown, checked: unknown): Promise<ShoppingResult> {
  const { supabase } = await requireUser();
  const parsed = z.object({ id: z.uuid(), checked: z.boolean() }).safeParse({ id, checked });
  if (!parsed.success) return fail("Artículo no válido.");

  const { error } = await supabase
    .from("shopping_items")
    .update({ checked: parsed.data.checked })
    .eq("id", parsed.data.id)
    .eq("is_manual", true);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/compra");
  return done();
}

export async function deleteManualItem(id: unknown): Promise<ShoppingResult> {
  const { supabase } = await requireUser();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return fail("Artículo no válido.");

  const { error } = await supabase
    .from("shopping_items")
    .delete()
    .eq("id", parsed.data)
    .eq("is_manual", true);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/compra");
  return done();
}
