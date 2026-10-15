-- Fingerprint of the recipe's title, ingredients and steps at conversion time.
-- Lets the app warn when the original recipe changed after a Thermomix version
-- was made (photo, notes or servings changes do not count).
alter table public.thermomix_versions
  add column source_signature text;
