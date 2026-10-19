-- How full the bowl gets in a Thermomix version: {peak_ml, step, fitting_servings}. The version
-- keeps the servings that were asked for; when it does not fit, the app warns instead of
-- shrinking the recipe on its own.
alter table public.thermomix_versions
  add column capacity jsonb;
