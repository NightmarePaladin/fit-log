-- Lets a signed-in user permanently delete THEIR OWN account.
-- Deleting the auth.users row cascades to profiles, workouts (-> workout_exercises -> workout_sets)
-- and the user's custom exercises. SECURITY DEFINER is required because clients cannot touch auth.users;
-- the function only ever deletes auth.uid(), never a caller-supplied id.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  -- Workouts first: their sets reference custom exercises, which would otherwise block the cascade.
  delete from public.workouts where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
