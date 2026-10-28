-- Display unit preference. Weights are ALWAYS stored in pounds (the canonical unit);
-- the app converts for display and input. Extra precision avoids rounding drift when a
-- kg value is converted to lb and back (e.g. 1.25 kg, 62.5 kg).
alter table public.profiles drop constraint if exists profiles_unit_check;
alter table public.profiles add constraint profiles_unit_check check (unit in ('lb', 'kg'));

alter table public.workout_sets alter column weight type numeric(9, 4);
