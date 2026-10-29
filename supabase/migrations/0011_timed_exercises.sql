-- Timed exercises (running, planks, rowing...): the set's `reps` column holds the duration in SECONDS and weight is 0.
-- A timed exercise is also reps_only, so everything that already handles "no weight" keeps working.
alter table public.exercises add column if not exists timed boolean not null default false;

-- Share links now also report whether an exercise is timed, so the public page can show 12:30 instead of "750 reps".
create or replace function public.get_shared_workout(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', w.name,
    'completed_at', w.completed_at,
    'owner_name', nullif(split_part(coalesce(p.display_name, ''), ' ', 1), ''),
    'exercises', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', e.name,
          'reps_only', e.reps_only,
          'timed', e.timed,
          'sets', coalesce((
            select jsonb_agg(
              jsonb_build_object('weight', s.weight, 'reps', s.reps, 'completed', s.completed)
              order by s.set_order)
            from public.workout_sets s where s.workout_exercise_id = we.id), '[]'::jsonb)
        ) order by we.position)
      from public.workout_exercises we
      join public.exercises e on e.id = we.exercise_id
      where we.workout_id = w.id), '[]'::jsonb)
  )
  from public.workout_shares sh
  join public.workouts w on w.id = sh.workout_id
  left join public.profiles p on p.id = w.user_id
  where sh.token = p_token
$$;
revoke execute on function public.get_shared_workout(text) from public;
grant execute on function public.get_shared_workout(text) to anon, authenticated;
