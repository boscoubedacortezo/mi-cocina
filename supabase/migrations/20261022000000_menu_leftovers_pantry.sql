-- A menu slot can be "sobras o improvisado": a meal with no recipe, that is not away from
-- home either. And the user keeps a pantry of staples that never go in the shopping list.
alter table public.menu_items
  add column leftovers boolean not null default false;

alter table public.menu_items
  add constraint menu_items_leftovers_has_no_recipe check (not (leftovers and recipe_id is not null)),
  add constraint menu_items_leftovers_not_away check (not (leftovers and away));

alter table public.user_settings
  add column pantry text[] not null default '{}';
