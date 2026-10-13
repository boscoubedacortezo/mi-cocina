-- Mi Cocina: initial schema.
-- Every table has RLS. Top-level tables are owned via user_id = auth.uid();
-- child tables inherit ownership from their parent row.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  servings integer not null default 4 check (servings > 0),
  prep_minutes integer check (prep_minutes >= 0),
  cook_minutes integer check (cook_minutes >= 0),
  tags text[] not null default '{}',
  source_type text not null default 'manual'
    check (source_type in ('manual', 'texto', 'url', 'foto')),
  source_url text,
  image_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_user_id_idx on public.recipes (user_id);
create index recipes_tags_idx on public.recipes using gin (tags);

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position integer not null,
  name text not null check (length(trim(name)) > 0),
  quantity numeric check (quantity >= 0),
  unit text check (unit in ('g', 'kg', 'ml', 'l', 'ud', 'cda', 'cdta', 'pizca', 'al gusto')),
  shop_section text not null default 'Otros'
    check (shop_section in (
      'Frutas y verduras', 'Carne', 'Pescado', 'Lácteos y huevos', 'Panadería',
      'Despensa', 'Congelados', 'Bebidas', 'Otros'
    )),
  optional boolean not null default false
);

create index recipe_ingredients_recipe_id_idx on public.recipe_ingredients (recipe_id, position);

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position integer not null,
  text text not null check (length(trim(text)) > 0)
);

create index recipe_steps_recipe_id_idx on public.recipe_steps (recipe_id, position);

create table public.thermomix_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  model text not null default 'TM7' check (model in ('TM7')),
  ingredients_text text not null default '',
  -- [{text, time_seconds, temperature ('Varoma' | number | null),
  --   speed ('cuchara' | '1'..'10' | 'turbo'), reverse, accessory}]
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  cookidoo_text text,
  created_at timestamptz not null default now()
);

create index thermomix_versions_recipe_id_idx on public.thermomix_versions (recipe_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Menus and shopping list
-- ---------------------------------------------------------------------------

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  date date not null,
  meal text not null check (meal in ('comida', 'cena')),
  recipe_id uuid references public.recipes (id) on delete set null,
  servings integer not null default 4 check (servings > 0),
  unique (menu_id, date, meal)
);

create index menu_items_recipe_id_idx on public.menu_items (recipe_id);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  quantity numeric check (quantity >= 0),
  unit text check (unit in ('g', 'kg', 'ml', 'l', 'ud', 'cda', 'cdta', 'pizca', 'al gusto')),
  shop_section text not null default 'Otros'
    check (shop_section in (
      'Frutas y verduras', 'Carne', 'Pescado', 'Lácteos y huevos', 'Panadería',
      'Despensa', 'Congelados', 'Bebidas', 'Otros'
    )),
  checked boolean not null default false,
  is_manual boolean not null default false
);

create index shopping_items_menu_id_idx on public.shopping_items (menu_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.thermomix_versions enable row level security;
alter table public.menus enable row level security;
alter table public.menu_items enable row level security;
alter table public.shopping_items enable row level security;

create policy "Own recipes" on public.recipes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Own recipe ingredients" on public.recipe_ingredients
  for all to authenticated
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())
  ));

create policy "Own recipe steps" on public.recipe_steps
  for all to authenticated
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())
  ));

create policy "Own thermomix versions" on public.thermomix_versions
  for all to authenticated
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.user_id = (select auth.uid())
  ));

create policy "Own menus" on public.menus
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- A menu item may only point to a recipe owned by the same user.
create policy "Own menu items" on public.menu_items
  for all to authenticated
  using (exists (
    select 1 from public.menus m
    where m.id = menu_id and m.user_id = (select auth.uid())
  ))
  with check (
    exists (
      select 1 from public.menus m
      where m.id = menu_id and m.user_id = (select auth.uid())
    )
    and (
      recipe_id is null
      or exists (
        select 1 from public.recipes r
        where r.id = recipe_id and r.user_id = (select auth.uid())
      )
    )
  );

create policy "Own shopping items" on public.shopping_items
  for all to authenticated
  using (exists (
    select 1 from public.menus m
    where m.id = menu_id and m.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.menus m
    where m.id = menu_id and m.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- Storage: private bucket for recipe photos, files under "<user_id>/..."
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images', 'recipe-images', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "Own recipe images: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Own recipe images: insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Own recipe images: update" on storage.objects
  for update to authenticated
  using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Own recipe images: delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
