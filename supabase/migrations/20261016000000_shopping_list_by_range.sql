-- The shopping list is no longer tied to a Monday-to-Sunday week: there is one active
-- list per user, for a range of dates chosen when it is generated.
-- Generated items the user removes ("I already have it") are hidden, not deleted,
-- so regenerating does not bring them back.

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 62),
  unique (user_id)
);

alter table public.shopping_lists enable row level security;

create policy "Own shopping lists" on public.shopping_lists
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Keep the most recent weekly list, turned into a one-week range. Older weekly
-- lists are dropped below: no history is kept.
insert into public.shopping_lists (user_id, start_date, end_date)
select distinct on (m.user_id) m.user_id, m.week_start, m.week_start + 6
from public.menus m
where exists (select 1 from public.shopping_items s where s.menu_id = m.id)
order by m.user_id, m.week_start desc;

alter table public.shopping_items
  add column list_id uuid references public.shopping_lists (id) on delete cascade,
  add column excluded boolean not null default false;

update public.shopping_items s
set list_id = l.id
from public.menus m
join public.shopping_lists l on l.user_id = m.user_id and l.start_date = m.week_start
where s.menu_id = m.id;

delete from public.shopping_items where list_id is null;

alter table public.shopping_items alter column list_id set not null;

-- Ownership now goes through the list (the old policy used menu_id).
drop policy "Own shopping items" on public.shopping_items;

create policy "Own shopping items" on public.shopping_items
  for all to authenticated
  using (exists (
    select 1 from public.shopping_lists l
    where l.id = list_id and l.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.shopping_lists l
    where l.id = list_id and l.user_id = (select auth.uid())
  ));

alter table public.shopping_items drop column menu_id;

create index shopping_items_list_id_idx on public.shopping_items (list_id);
