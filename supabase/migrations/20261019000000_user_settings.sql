-- Per-user settings, one row per user. For now: the menu preferences, a JSON object
-- validated by the app (a missing key means its default), so a new preference needs no migration.
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  menu_preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(menu_preferences) = 'object'),
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "Own settings" on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
