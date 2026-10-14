-- Thermomix versions keep the servings they were converted for (Cookidoo asks
-- for them) and the AI's adaptation notes (capacity, batches...).
alter table public.thermomix_versions
  add column servings integer check (servings > 0 and servings <= 100),
  add column notes text;
