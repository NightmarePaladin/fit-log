-- Atomic create/replace of a whole workout. SECURITY INVOKER: RLS still applies,
-- so a user can never write into someone else's workout.
-- p_exercises: [{ "exercise_id": uuid, "sets": [{ "weight": 135, "reps": 10, "completed": true }] }]
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

  if p_id is null then
    insert into public.workouts (user_id, name, status, started_at, completed_at)
    values (auth.uid(), p_name, 'completed', p_started_at, p_completed_at)
    returning id into v_id;
  else
    update public.workouts
       set name = p_name, started_at = p_started_at, completed_at = p_completed_at, status = 'completed'
     where id = p_id and user_id = auth.uid()
    returning id into v_id;
    if v_id is null then
      raise exception 'workout not found';
    end if;
    delete from public.workout_exercises where workout_id = v_id;
  end if;

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
