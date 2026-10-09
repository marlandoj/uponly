-- UPONLY-1: exactly one GameMaster per squad.
-- The role choice is gone from the app: create_circle always makes the creator
-- the GameMaster, join_circle always makes the joiner a gamer. p_household_role
-- is kept on both signatures for compatibility but ignored.
-- Adds a partial unique index (one gamemaster per circle) unless a squad already
-- has several — existing rows are never deleted or demoted. Idempotent.

do $$
declare
  v_dupes integer;
begin
  select count(*) into v_dupes
  from (
    select circle_id
    from public.circle_members
    where household_role = 'gamemaster'
    group by circle_id
    having count(*) > 1
  ) d;

  if v_dupes > 0 then
    raise notice 'skipping one_gamemaster_per_circle: % squads have multiple gamemasters', v_dupes;
  else
    create unique index if not exists one_gamemaster_per_circle
      on public.circle_members (circle_id)
      where household_role = 'gamemaster';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- create_circle: 0014's version, creator is always the GameMaster.
-- CREATE OR REPLACE keeps the existing grants.
-- ---------------------------------------------------------------------------

create or replace function public.create_circle(p_name text, p_household_role text default 'gamemaster')
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
    raise exception 'squad name must be 1-40 characters' using errcode = '22023';
  end if;
  if exists (select 1 from public.circle_members where user_id = v_uid) then
    raise exception 'already in a squad' using errcode = '23505';
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

  -- p_household_role is ignored: the squad's creator is its one GameMaster.
  insert into public.circle_members (circle_id, user_id, role, household_role)
  values (v_circle.id, v_uid, 'owner', 'gamemaster');

  return v_circle;
end;
$$;


-- ---------------------------------------------------------------------------
-- join_circle: 0014's version, joiners are always gamers — so this RPC can
-- never trip one_gamemaster_per_circle.
-- ---------------------------------------------------------------------------

create or replace function public.join_circle(p_code text, p_household_role text default 'gamer')
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
    raise exception 'no squad with that code' using errcode = 'P0002';
  end if;

  -- Idempotent re-join; an existing member keeps their role.
  -- p_household_role is ignored: everyone who joins is a gamer.
  insert into public.circle_members (circle_id, user_id, role, household_role)
  values (v_circle.id, v_uid, 'member', 'gamer')
  on conflict (circle_id, user_id) do nothing;

  return v_circle;
exception
  when unique_violation then
    raise exception 'already in a squad' using errcode = '23505';
end;
$$;
