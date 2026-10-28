-- Reps-only (bodyweight) exercises: logged with reps and no weight. Additive; existing rows default to false.
alter table public.exercises add column if not exists reps_only boolean not null default false;

-- Built-in bodyweight exercises.
update public.exercises
   set reps_only = true
 where user_id is null
   and name in ('Push-Up', 'Pull-Up', 'Dip', 'Hanging Leg Raise');
