-- The generated part of the shopping list is no longer stored: it is computed from the
-- menu every time, so it can never be out of date. Stored rows keep only the user's
-- marks on generated lines (bought, or removed because it is already at home) and the
-- items added by hand.
--   key             identity of a generated line (same product, same kind of unit)
--   marked_quantity the quantity needed when it was marked; if the menu later needs more,
--                   the line shows up again as pending
alter table public.shopping_items
  add column key text,
  add column marked_quantity numeric;

-- Old snapshot rows of generated items have no key: the menu recomputes them.
delete from public.shopping_items where not is_manual;

-- One mark per line and list. Manual items have no key (nulls never collide).
alter table public.shopping_items
  add constraint shopping_items_list_key_unique unique (list_id, key);
