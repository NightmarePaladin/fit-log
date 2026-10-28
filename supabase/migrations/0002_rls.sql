-- Row Level Security: every user-owned row is reachable only by its owner.

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;

-- profiles
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- exercises: global library is read-only; users manage only their custom rows
create policy exercises_select on public.exercises for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy exercises_insert_own on public.exercises for insert to authenticated
  with check (user_id = (select auth.uid()) and is_custom = true);
create policy exercises_update_own on public.exercises for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and is_custom = true);
create policy exercises_delete_own on public.exercises for delete to authenticated
  using (user_id = (select auth.uid()));

-- workouts
create policy workouts_select_own on public.workouts for select to authenticated
  using (user_id = (select auth.uid()));
create policy workouts_insert_own on public.workouts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy workouts_update_own on public.workouts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy workouts_delete_own on public.workouts for delete to authenticated
  using (user_id = (select auth.uid()));

-- workout_exercises: ownership via parent workout
create policy we_select_own on public.workout_exercises for select to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())));
create policy we_insert_own on public.workout_exercises for insert to authenticated
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())));
create policy we_update_own on public.workout_exercises for update to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())));
create policy we_delete_own on public.workout_exercises for delete to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())));

-- workout_sets: ownership via workout_exercises -> workouts
create policy ws_select_own on public.workout_sets for select to authenticated
  using (exists (
    select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = (select auth.uid())));
create policy ws_insert_own on public.workout_sets for insert to authenticated
  with check (exists (
    select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = (select auth.uid())));
create policy ws_update_own on public.workout_sets for update to authenticated
  using (exists (
    select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = (select auth.uid())));
create policy ws_delete_own on public.workout_sets for delete to authenticated
  using (exists (
    select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = (select auth.uid())));

-- Anonymous role gets nothing.
revoke all on public.profiles, public.exercises, public.workouts, public.workout_exercises, public.workout_sets from anon;
