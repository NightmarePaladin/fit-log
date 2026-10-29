-- W.A.L.T. (We All Lift Together): a live group workout for up to 4 people.
--   * One person starts a session and shares an 8-character join code; others join with it (no buddy link needed).
--   * Everyone sees the same exercise list. Each person logs THEIR OWN sets, and sees the others' sets live.
--   * Finishing is per person: the client saves each person's own sets into their own workout history.
-- Security model: only members can read a session. Members can only write their own sets. Sessions and
-- membership change only through the functions below (SECURITY DEFINER), never by direct insert.

create table public.walt_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'W.A.L.T. session' check (char_length(name) between 1 and 60),
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index walt_sessions_host_idx on public.walt_sessions (host_id);

create table public.walt_members (
  session_id uuid not null references public.walt_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (session_id, user_id)
);
create index walt_members_user_idx on public.walt_members (user_id);

create table public.walt_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.walt_sessions (id) on delete cascade,
  -- set only for built-in exercises (everyone can resolve it); custom ones are matched by name on each device
  exercise_id uuid references public.exercises (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  mode text not null default 'weight' check (mode in ('weight', 'reps', 'time')),
  position int not null default 0,
  added_by uuid not null default auth.uid() references auth.users (id) on delete cascade
);
create index walt_exercises_session_idx on public.walt_exercises (session_id);
create index walt_exercises_added_by_idx on public.walt_exercises (added_by);
create index walt_exercises_exercise_idx on public.walt_exercises (exercise_id);

create table public.walt_sets (
  id uuid primary key,
  walt_exercise_id uuid not null references public.walt_exercises (id) on delete cascade,
  session_id uuid not null references public.walt_sessions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_order int not null check (set_order >= 1),
  weight numeric(9, 4) not null default 0 check (weight >= 0),
  reps int not null default 0 check (reps >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now()
);
create index walt_sets_session_idx on public.walt_sets (session_id);
create index walt_sets_exercise_idx on public.walt_sets (walt_exercise_id);
create index walt_sets_user_idx on public.walt_sets (user_id);

alter table public.walt_sessions enable row level security;
alter table public.walt_members enable row level security;
alter table public.walt_exercises enable row level security;
alter table public.walt_sets enable row level security;

-- Helpers (SECURITY DEFINER so policies can ask about membership without recursing into their own RLS).
create or replace function public.is_walt_member(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.walt_members m
                 where m.session_id = p_session and m.user_id = (select auth.uid()))
$$;

-- Active = not ended and started within the last 24 hours (sessions expire on their own).
create or replace function public.is_walt_active(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.walt_sessions s
                 where s.id = p_session and s.status = 'active' and s.created_at > now() - interval '24 hours')
$$;

create or replace function public.is_walt_host(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.walt_sessions s
                 where s.id = p_session and s.host_id = (select auth.uid()))
$$;

revoke execute on function public.is_walt_member(uuid), public.is_walt_active(uuid), public.is_walt_host(uuid) from public, anon;
grant execute on function public.is_walt_member(uuid), public.is_walt_active(uuid), public.is_walt_host(uuid) to authenticated;

-- Reads: members only.
create policy walt_sessions_select on public.walt_sessions for select to authenticated
  using (public.is_walt_member(id));
create policy walt_members_select on public.walt_members for select to authenticated
  using (public.is_walt_member(session_id));
create policy walt_exercises_select on public.walt_exercises for select to authenticated
  using (public.is_walt_member(session_id));
create policy walt_sets_select on public.walt_sets for select to authenticated
  using (public.is_walt_member(session_id));

-- A member may mark THEIR OWN row finished (and nothing else about it: see the column grant below).
create policy walt_members_update_own on public.walt_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- The exercise list is shared: any member can add; only whoever added it (or the host) can remove it.
create policy walt_exercises_insert on public.walt_exercises for insert to authenticated
  with check (added_by = (select auth.uid()) and public.is_walt_member(session_id) and public.is_walt_active(session_id));
create policy walt_exercises_delete on public.walt_exercises for delete to authenticated
  using (public.is_walt_active(session_id) and (added_by = (select auth.uid()) or public.is_walt_host(session_id)));

-- Sets: you only ever write your own, into an exercise of a session you are in.
create policy walt_sets_insert on public.walt_sets for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_walt_member(session_id) and public.is_walt_active(session_id)
    and exists (select 1 from public.walt_exercises e where e.id = walt_exercise_id and e.session_id = walt_sets.session_id)
  );
create policy walt_sets_update on public.walt_sets for update to authenticated
  using (user_id = (select auth.uid()) and public.is_walt_active(session_id))
  with check (user_id = (select auth.uid()) and public.is_walt_member(session_id) and public.is_walt_active(session_id)
              and exists (select 1 from public.walt_exercises e where e.id = walt_exercise_id and e.session_id = walt_sets.session_id));
create policy walt_sets_delete on public.walt_sets for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_walt_active(session_id));

-- Table privileges: nothing for anon; authenticated gets only what the policies above are meant to allow.
revoke all on public.walt_sessions, public.walt_members, public.walt_exercises, public.walt_sets from anon, authenticated;
grant select on public.walt_sessions, public.walt_members, public.walt_exercises, public.walt_sets to authenticated;
grant update (finished_at) on public.walt_members to authenticated;
grant insert, delete on public.walt_exercises to authenticated;
grant insert, update, delete on public.walt_sets to authenticated;

-- ============ Functions ============
create or replace function public.walt_display_name(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(split_part(coalesce((select p.display_name from public.profiles p where p.id = p_user), ''), ' ', 1), ''), 'Lifter')
$$;
revoke execute on function public.walt_display_name(uuid) from public, anon, authenticated;

create or replace function public.create_walt_session(p_name text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  v_code text;
  v_bytes bytea;
  v_id uuid;
  v_active int;
  v_name text := left(coalesce(nullif(trim(p_name), ''), 'W.A.L.T. session'), 60);
  i int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select count(*) into v_active from public.walt_sessions
   where host_id = auth.uid() and status = 'active' and created_at > now() - interval '24 hours';
  if v_active >= 3 then raise exception 'too_many_active_sessions'; end if;
  loop
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    begin
      insert into public.walt_sessions (code, host_id, name) values (v_code, auth.uid(), v_name) returning id into v_id;
      exit;
    exception when unique_violation then
      null; -- vanishingly unlikely code collision: try another
    end;
  end loop;
  insert into public.walt_members (session_id, user_id, display_name)
  values (v_id, auth.uid(), public.walt_display_name(auth.uid()));
  return jsonb_build_object('id', v_id, 'code', v_code);
end;
$$;

create or replace function public.join_walt_session(p_code text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.walt_sessions%rowtype;
  v_count int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_s from public.walt_sessions where code = upper(trim(p_code)) for update;
  -- Same message for unknown, ended and expired codes so codes cannot be probed.
  if not found or v_s.status <> 'active' or v_s.created_at <= now() - interval '24 hours' then
    raise exception 'invalid_or_expired_code';
  end if;
  if exists (select 1 from public.walt_members where session_id = v_s.id and user_id = auth.uid()) then
    return v_s.id; -- already in: rejoining is fine
  end if;
  select count(*) into v_count from public.walt_members where session_id = v_s.id;
  if v_count >= 4 then raise exception 'session_full'; end if;
  insert into public.walt_members (session_id, user_id, display_name)
  values (v_s.id, auth.uid(), public.walt_display_name(auth.uid()));
  return v_s.id;
end;
$$;

create or replace function public.end_walt_session(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.walt_sessions set status = 'ended', ended_at = now()
   where id = p_id and host_id = auth.uid() and status = 'active';
  if not found then raise exception 'not_host_or_not_active'; end if;
end;
$$;

create or replace function public.leave_walt_session(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.is_walt_host(p_id) then raise exception 'host_must_end'; end if;
  delete from public.walt_sets where session_id = p_id and user_id = auth.uid();
  delete from public.walt_members where session_id = p_id and user_id = auth.uid();
end;
$$;

revoke execute on function public.create_walt_session(text), public.join_walt_session(text),
  public.end_walt_session(uuid), public.leave_walt_session(uuid) from public, anon;
grant execute on function public.create_walt_session(text), public.join_walt_session(text),
  public.end_walt_session(uuid), public.leave_walt_session(uuid) to authenticated;

-- ============ Live updates ============
-- Full replica identity so DELETE events carry the session id (clients filter on it). Realtime also respects RLS.
alter table public.walt_sessions replica identity full;
alter table public.walt_members replica identity full;
alter table public.walt_exercises replica identity full;
alter table public.walt_sets replica identity full;
alter publication supabase_realtime add table public.walt_sessions, public.walt_members, public.walt_exercises, public.walt_sets;
