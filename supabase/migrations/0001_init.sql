-- UpOnly — 0001_init: profiles, one circle per user, private evidence bucket.
--
-- Data API exposure policy (Supabase change, 2026-10-30): new tables in
-- `public` stop receiving automatic grants for anon/authenticated/service_role.
-- This migration does NOT rely on the auto-grants either way: every table is
-- revoked to zero first, then granted exactly what its RLS policies allow.
--   * authenticated : only the SELECT / INSERT / UPDATE the policies permit
--   * anon          : nothing (UpOnly has no intentional public reads; rating
--                     links go through a server route handler)
--   * service_role  : explicit grant for completeness (bypasses RLS anyway)
-- RLS is ON for every table. Never "fix" a 42501 with GRANT ALL — add the
-- narrow grant that matches a policy instead.
--
-- Writes that must be atomic or that need to see rows the caller cannot yet
-- read (create circle + membership, join by code) go through SECURITY DEFINER
-- RPCs, so authenticated has no direct INSERT on circles / circle_members.

-- ---------------------------------------------------------------------------
-- profiles  (spec: `users`; 1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text not null default 'Player'
                     check (char_length(display_name) between 1 and 40),
  level            numeric(4, 2) not null default 3.50,
  xp               integer not null default 0 check (xp >= 0),
  streak           integer not null default 0 check (streak >= 0),
  quests_completed integer not null default 0 check (quests_completed >= 0),
  rater_rep        numeric(4, 2) not null default 1.00,
  created_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- circles + circle_members  (one circle per user)
-- ---------------------------------------------------------------------------
create table public.circles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 40),
  -- 6-char invite code; alphabet excludes 0/O/1/I/L to survive being read aloud.
  join_code  text not null unique check (join_code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.circles enable row level security;

create table public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  -- server timestamp; anti-abuse rule "raters joined >= 24h before the quest" reads this.
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id),
  unique (user_id)
);

alter table public.circle_members enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies on circle_members don't recurse)
-- ---------------------------------------------------------------------------
create function public.is_circle_member(p_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.circle_members m
    where m.circle_id = p_circle_id and m.user_id = (select auth.uid())
  );
$$;

create function public.shares_circle_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.circle_members mine
    join public.circle_members theirs on theirs.circle_id = mine.circle_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
create policy "profiles: read self and circle-mates"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_circle_with(id));

create policy "profiles: update own row"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "circles: members read"
  on public.circles for select to authenticated
  using (public.is_circle_member(id));

create policy "circle_members: members read roster"
  on public.circle_members for select to authenticated
  using (public.is_circle_member(circle_id));

-- ---------------------------------------------------------------------------
-- Explicit least-privilege Data API grants
-- ---------------------------------------------------------------------------
revoke all on table public.profiles, public.circles, public.circle_members
  from anon, authenticated, service_role;

-- profiles: rows are created by the auth trigger below; users may only rename
-- themselves. level / xp / streak / rep are server-written, never client-written.
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

-- circles / circle_members: read-only for clients; writes via RPCs below.
grant select on table public.circles to authenticated;
grant select on table public.circle_members to authenticated;

grant select, insert, update, delete on table
  public.profiles, public.circles, public.circle_members
  to service_role;

-- ---------------------------------------------------------------------------
-- Profile bootstrap on sign-up
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(left(split_part(new.email, '@', 1), 40), ''), 'Player')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Circle RPCs
-- ---------------------------------------------------------------------------
create function public.gen_join_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), ''
  )
  from generate_series(1, 6);
$$;

create function public.create_circle(p_name text)
returns public.circles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_circle public.circles;
  v_name   text := btrim(p_name);
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 40 then
    raise exception 'circle name must be 1-40 characters' using errcode = '22023';
  end if;
  if exists (select 1 from public.circle_members where user_id = v_uid) then
    raise exception 'already in a circle' using errcode = '23505';
  end if;

  loop
    begin
      insert into public.circles (name, join_code, created_by)
      values (v_name, public.gen_join_code(), v_uid)
      returning * into v_circle;
      exit;
    exception when unique_violation then
      -- join_code collision; retry with a fresh code
    end;
  end loop;

  insert into public.circle_members (circle_id, user_id, role)
  values (v_circle.id, v_uid, 'owner');

  return v_circle;
end;
$$;

create function public.join_circle(p_code text)
returns public.circles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_circle public.circles;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_circle
  from public.circles
  where join_code = upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));

  if v_circle.id is null then
    raise exception 'no circle with that code' using errcode = 'P0002';
  end if;

  insert into public.circle_members (circle_id, user_id, role)
  values (v_circle.id, v_uid, 'member')
  on conflict (circle_id, user_id) do nothing;  -- idempotent re-join

  return v_circle;
exception
  when unique_violation then
    raise exception 'already in a circle' using errcode = '23505';
end;
$$;

-- Functions are EXECUTE-able by PUBLIC by default; lock them down too.
revoke execute on function
  public.is_circle_member(uuid),
  public.shares_circle_with(uuid),
  public.handle_new_user(),
  public.gen_join_code(),
  public.create_circle(text),
  public.join_circle(text)
  from public, anon, authenticated;

grant execute on function
  public.is_circle_member(uuid),
  public.shares_circle_with(uuid),
  public.create_circle(text),
  public.join_circle(text)
  to authenticated;

grant execute on function
  public.is_circle_member(uuid),
  public.shares_circle_with(uuid),
  public.gen_join_code(),
  public.create_circle(text),
  public.join_circle(text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Storage: private evidence bucket, owner-only by path prefix
-- Object keys MUST be "<auth.uid()>/<...>". Circle-mates never read objects
-- directly; the server hands out 5-minute signed URLs after a membership check.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 10485760, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "evidence: owner read"
  on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "evidence: owner upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "evidence: owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "evidence: owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
