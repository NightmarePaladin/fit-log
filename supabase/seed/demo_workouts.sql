-- OPTIONAL demo data: ~4 weeks of workouts so Progress comparisons can be demonstrated.
-- Run in the Supabase SQL editor AFTER you have signed in once with Google.
-- 1) Replace the email below with your Google account email.
-- 2) Run the whole script. Re-running adds duplicates; delete via the app's History screen.
--
-- Week 0 = current week (Mon-based), week 1 = previous week, etc. Squat shows a like-for-like
-- gain (225x10 -> 235x10). Bench changes reps (155x8 -> 160x6) so the app must NOT call it
-- a strength percentage.

do $$
declare
  v_email text := 'you@example.com';
  uid uuid;
  w int;
  d int;
  day timestamptz;
  wid uuid;
  we uuid;
  squat_w numeric;
  bench_w numeric; bench_r int;
  ex_id uuid;
begin
  select id into uid from auth.users where email = v_email;
  if uid is null then raise exception 'No user with email %', v_email; end if;

  for w in 0..3 loop
    squat_w := case w when 3 then 215 when 2 then 220 when 1 then 225 else 235 end;
    bench_w := case w when 3 then 145 when 2 then 150 when 1 then 155 else 160 end;
    bench_r := case w when 0 then 6 else 8 end;

    foreach d in array array[0, 2, 4] loop
      day := date_trunc('week', now()) - make_interval(weeks => w) + make_interval(days => d, hours => 18);
      continue when day > now();

      insert into public.workouts (user_id, name, status, started_at, completed_at)
      values (uid, case d when 0 then 'Lower A' when 2 then 'Upper' else 'Lower B' end, 'completed', day - interval '1 hour', day)
      returning id into wid;

      if d in (0, 4) then
        select id into ex_id from public.exercises where name = 'Barbell Squat';
        insert into public.workout_exercises (workout_id, exercise_id, position) values (wid, ex_id, 1) returning id into we;
        insert into public.workout_sets (workout_exercise_id, exercise_id, set_order, weight, reps, completed, completed_at)
        select we, ex_id, s, case when d = 0 then squat_w else squat_w - 20 end, 10, true, day from generate_series(1, 3) s;

        select id into ex_id from public.exercises where name = 'Romanian Deadlift';
        insert into public.workout_exercises (workout_id, exercise_id, position) values (wid, ex_id, 2) returning id into we;
        insert into public.workout_sets (workout_exercise_id, exercise_id, set_order, weight, reps, completed, completed_at)
        select we, ex_id, s, 185 + 5 * (3 - w), 8, true, day from generate_series(1, 3) s;
      else
        select id into ex_id from public.exercises where name = 'Barbell Bench Press';
        insert into public.workout_exercises (workout_id, exercise_id, position) values (wid, ex_id, 1) returning id into we;
        insert into public.workout_sets (workout_exercise_id, exercise_id, set_order, weight, reps, completed, completed_at)
        select we, ex_id, s, bench_w, bench_r, true, day from generate_series(1, 3) s;

        select id into ex_id from public.exercises where name = 'Barbell Row';
        insert into public.workout_exercises (workout_id, exercise_id, position) values (wid, ex_id, 2) returning id into we;
        insert into public.workout_sets (workout_exercise_id, exercise_id, set_order, weight, reps, completed, completed_at)
        select we, ex_id, s, 125 + 5 * (3 - w), 10, true, day from generate_series(1, 3) s;

        select id into ex_id from public.exercises where name = 'Overhead Press';
        insert into public.workout_exercises (workout_id, exercise_id, position) values (wid, ex_id, 3) returning id into we;
        insert into public.workout_sets (workout_exercise_id, exercise_id, set_order, weight, reps, completed, completed_at)
        select we, ex_id, s, 85 + 5 * (3 - w) / 3, 8, true, day from generate_series(1, 3) s;
      end if;
    end loop;
  end loop;
end $$;
