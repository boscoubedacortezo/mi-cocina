-- Two fixed categories per recipe, chosen by the AI from closed lists:
-- the role of the dish in a meal, and its main ingredient.
-- Free-form tags stay in recipes.tags for everything else.
alter table public.recipes
  add column course text
    check (course in ('desayuno', 'entrante', 'principal', 'acompanamiento', 'postre')),
  add column main_ingredient text
    check (main_ingredient in (
      'carne', 'pescado', 'verdura', 'legumbres', 'pasta_arroz', 'huevos', 'fruta_dulce'
    ));

create index recipes_course_idx on public.recipes (user_id, course);
create index recipes_main_ingredient_idx on public.recipes (user_id, main_ingredient);
