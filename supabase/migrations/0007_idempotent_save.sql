-- Offline support: the phone generates each workout's id, so uploading the same workout twice
-- (a retry after a flaky connection) REPLACES it instead of creating a duplicate.
-- If p_id belongs to another user the call fails, so ids can never be used to overwrite someone else's data.
-- Still SECURITY INVOKER: RLS applies to every statement.
create or replace function public.save_workout(
  p_id uuid,
  p_name text,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_exercises jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_we uuid;
  ex jsonb;
  st jsonb;
  ex_pos int := 0;
  st_pos int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.workouts (id, user_id, name, status, started_at, completed_at)
  values (coalesce(p_id, gen_random_uuid()), auth.uid(), p_name, 'completed', p_started_at, p_completed_at)
  on conflict (id) do update
    set name = excluded.name,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        status = 'completed'
    where public.workouts.user_id = auth.uid()
  returning id into v_id;

  if v_id is null then
    raise exception 'workout not found';
  end if;

  -- Replace children (cascades to sets) so a re-upload or edit yields exactly the submitted contents.
  delete from public.workout_exercises where workout_id = v_id;

  for ex in select * from jsonb_array_elements(p_exercises) loop
    ex_pos := ex_pos + 1;
    insert into public.workout_exercises (workout_id, exercise_id, position)
    values (v_id, (ex ->> 'exercise_id')::uuid, ex_pos)
    returning id into v_we;

    st_pos := 0;
    for st in select * from jsonb_array_elements(ex -> 'sets') loop
      st_pos := st_pos + 1;
      insert into public.workout_sets
        (workout_exercise_id, exercise_id, set_order, weight, reps, completed, completed_at)
      values (
        v_we, (ex ->> 'exercise_id')::uuid, st_pos,
        coalesce((st ->> 'weight')::numeric, 0),
        coalesce((st ->> 'reps')::int, 0),
        coalesce((st ->> 'completed')::boolean, false),
        case when coalesce((st ->> 'completed')::boolean, false) then p_completed_at end
      );
    end loop;
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.save_workout(uuid, text, timestamptz, timestamptz, jsonb) from public, anon;
grant execute on function public.save_workout(uuid, text, timestamptz, timestamptz, jsonb) to authenticated;
