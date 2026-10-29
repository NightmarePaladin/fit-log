-- Sharing: (1) private, revocable share links for a single workout (viewable without an account)
--          (2) buddies: two accounts that agreed (via an invite code) to see each other's lifts, read-only.
-- IMPORTANT: buddy policies widen SELECT on workouts/sets/exercises/profiles, so app queries for "my" data
-- must filter by user_id explicitly (the app does).

-- ============ 1. Share links ============
create table public.workout_shares (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  workout_id uuid not null unique references public.workouts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index workout_shares_user_idx on public.workout_shares (user_id);
alter table public.workout_shares enable row level security;

create policy share_links_select_own on public.workout_shares for select to authenticated
  using (user_id = (select auth.uid()));
create policy share_links_insert_own on public.workout_shares for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
  );
create policy share_links_delete_own on public.workout_shares for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.workout_shares from anon;

-- Anyone holding a valid token can read exactly that workout (nothing else, no account needed).
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

-- ============ 2. Buddies ============
-- A row (owner, viewer) means: viewer may read owner's workouts. Accepting an invite creates both directions.
create table public.buddy_shares (
  owner_id uuid not null references auth.users (id) on delete cascade,
  viewer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, viewer_id),
  check (owner_id <> viewer_id)
);
create index buddy_shares_viewer_idx on public.buddy_shares (viewer_id);
alter table public.buddy_shares enable row level security;
create policy buddy_shares_select on public.buddy_shares for select to authenticated
  using (owner_id = (select auth.uid()) or viewer_id = (select auth.uid()));
-- Either person can end sharing in either direction. Rows are only ever created by accept_buddy_invite().
create policy buddy_shares_delete on public.buddy_shares for delete to authenticated
  using (owner_id = (select auth.uid()) or viewer_id = (select auth.uid()));
revoke all on public.buddy_shares from anon;

create table public.buddy_invites (
  code text primary key,
  inviter_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null
);
create index buddy_invites_inviter_idx on public.buddy_invites (inviter_id);
alter table public.buddy_invites enable row level security;
create policy buddy_invites_select_own on public.buddy_invites for select to authenticated
  using (inviter_id = (select auth.uid()));
create policy buddy_invites_delete_own on public.buddy_invites for delete to authenticated
  using (inviter_id = (select auth.uid()));
revoke all on public.buddy_invites from anon;

create or replace function public.create_buddy_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  v_code text;
  v_bytes bytea;
  v_active int;
  i int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select count(*) into v_active from public.buddy_invites
   where inviter_id = auth.uid() and used_at is null and expires_at > now();
  if v_active >= 5 then
    raise exception 'too_many_active_invites';
  end if;
  loop
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    begin
      insert into public.buddy_invites (code, inviter_id) values (v_code, auth.uid());
      exit;
    exception when unique_violation then
      null; -- extremely unlikely collision: try again
    end;
  end loop;
  return v_code;
end;
$$;
revoke execute on function public.create_buddy_invite() from public, anon;
grant execute on function public.create_buddy_invite() to authenticated;

create or replace function public.accept_buddy_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.buddy_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into v_inv from public.buddy_invites where code = upper(trim(p_code)) for update;
  -- Same message for missing, used and expired codes so codes cannot be probed.
  if not found or v_inv.used_at is not null or v_inv.expires_at <= now() then
    raise exception 'invalid_or_expired_code';
  end if;
  if v_inv.inviter_id = auth.uid() then
    raise exception 'own_code';
  end if;
  insert into public.buddy_shares (owner_id, viewer_id)
  values (v_inv.inviter_id, auth.uid()), (auth.uid(), v_inv.inviter_id)
  on conflict do nothing;
  update public.buddy_invites set used_at = now(), used_by = auth.uid() where code = v_inv.code;
  return v_inv.inviter_id;
end;
$$;
revoke execute on function public.accept_buddy_invite(text) from public, anon;
grant execute on function public.accept_buddy_invite(text) to authenticated;

-- Buddies can READ (never write) the owner's lifts.
create policy workouts_select_buddy on public.workouts for select to authenticated
  using (exists (select 1 from public.buddy_shares b
                 where b.owner_id = workouts.user_id and b.viewer_id = (select auth.uid())));
create policy we_select_buddy on public.workout_exercises for select to authenticated
  using (exists (select 1 from public.workouts w
                 join public.buddy_shares b on b.owner_id = w.user_id
                 where w.id = workout_id and b.viewer_id = (select auth.uid())));
create policy ws_select_buddy on public.workout_sets for select to authenticated
  using (exists (select 1 from public.workout_exercises we
                 join public.workouts w on w.id = we.workout_id
                 join public.buddy_shares b on b.owner_id = w.user_id
                 where we.id = workout_exercise_id and b.viewer_id = (select auth.uid())));
create policy exercises_select_buddy on public.exercises for select to authenticated
  using (user_id is not null and exists (select 1 from public.buddy_shares b
                 where b.owner_id = exercises.user_id and b.viewer_id = (select auth.uid())));
create policy profiles_select_buddy on public.profiles for select to authenticated
  using (exists (select 1 from public.buddy_shares b
                 where (b.owner_id = profiles.id and b.viewer_id = (select auth.uid()))
                    or (b.viewer_id = profiles.id and b.owner_id = (select auth.uid()))));
