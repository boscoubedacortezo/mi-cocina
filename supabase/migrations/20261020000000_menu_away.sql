-- A slot can be marked "away from home": no recipe, and the AI leaves it alone.
alter table public.menu_items
  add column away boolean not null default false;

alter table public.menu_items
  add constraint menu_items_away_has_no_recipe check (not (away and recipe_id is not null));
