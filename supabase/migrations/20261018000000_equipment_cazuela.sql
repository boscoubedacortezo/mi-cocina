-- Equipment key 'olla' becomes 'cazuela' (label and key now match).
alter table public.recipes drop constraint recipes_equipment_check;

update public.recipes
  set equipment = array_replace(equipment, 'olla', 'cazuela')
  where 'olla' = any (equipment);

alter table public.recipes
  add constraint recipes_equipment_check
    check (equipment <@ array[
      'horno', 'sarten', 'cazuela', 'olla_presion', 'plancha',
      'freidora_aire', 'microondas', 'sin_coccion'
    ]::text[]);
