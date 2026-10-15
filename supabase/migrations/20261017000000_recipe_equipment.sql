-- How a recipe is cooked, as a list from a closed set (several allowed: a pan-seared
-- roast finished in the oven is "sarten" and "horno"). Thermomix is not stored here:
-- it is derived from having a Thermomix version or coming from Cookidoo.
alter table public.recipes
  add column equipment text[] not null default '{}'
    check (equipment <@ array[
      'horno', 'sarten', 'olla', 'olla_presion', 'plancha',
      'freidora_aire', 'microondas', 'sin_coccion'
    ]::text[]);

create index recipes_equipment_idx on public.recipes using gin (equipment);
