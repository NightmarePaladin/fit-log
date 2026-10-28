-- FitLog schema. Weights are stored in pounds (profiles.unit = 'lb').

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  unit text not null default 'lb' check (unit in ('lb')),
  created_at timestamptz not null default now()
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade, -- null = global library
  name text not null check (char_length(trim(name)) between 1 and 80),
  muscle_group text,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  check ((user_id is null) = (is_custom = false))
);
create unique index exercises_global_name_uq on public.exercises (lower(name)) where user_id is null;
create unique index exercises_user_name_uq on public.exercises (user_id, lower(name)) where user_id is not null;

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text,
  notes text,
  status text not null default 'completed' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index workouts_user_completed_idx on public.workouts (user_id, completed_at desc);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  position int not null default 0
);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id);
create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  set_order int not null,
  weight numeric(7, 2) not null default 0 check (weight >= 0),
  reps int not null default 0 check (reps >= 0),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index workout_sets_we_idx on public.workout_sets (workout_exercise_id);
create index workout_sets_exercise_idx on public.workout_sets (exercise_id);

-- Create a profile row whenever a user signs up (Google name/avatar from metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
