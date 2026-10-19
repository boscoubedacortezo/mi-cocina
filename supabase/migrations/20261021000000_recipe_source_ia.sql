-- Recipes can now be created by the AI from a short description ("tortilla a la francesa").
alter table public.recipes drop constraint recipes_source_type_check;

alter table public.recipes
  add constraint recipes_source_type_check
    check (source_type in ('manual', 'texto', 'url', 'foto', 'ia'));
