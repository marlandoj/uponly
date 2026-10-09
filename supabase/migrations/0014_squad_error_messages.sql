-- UPONLY-1: squad wording in user-facing database error messages.
-- Recreates create_circle / join_circle / create_reward with "squad"
-- phrasing (was "circle"). Behavior unchanged. Idempotent.

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
  if p_household_role is null or p_household_role not in ('gamemaster', 'gamer') then
    raise exception 'household role must be gamemaster or gamer' using errcode = '22023';
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

  insert into public.circle_members (circle_id, user_id, role, household_role)
  values (v_circle.id, v_uid, 'owner', p_household_role);

  return v_circle;
end;
$$;


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
  if p_household_role is null or p_household_role not in ('gamemaster', 'gamer') then
    raise exception 'household role must be gamemaster or gamer' using errcode = '22023';
  end if;

  select * into v_circle
  from public.circles
  where join_code = upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));

  if v_circle.id is null then
    raise exception 'no squad with that code' using errcode = 'P0002';
  end if;

  -- Idempotent re-join; an existing member keeps the role they joined with.
  insert into public.circle_members (circle_id, user_id, role, household_role)
  values (v_circle.id, v_uid, 'member', p_household_role)
  on conflict (circle_id, user_id) do nothing;

  return v_circle;
exception
  when unique_violation then
    raise exception 'already in a squad' using errcode = '23505';
end;
$$;

-- ---------------------------------------------------------------------------
-- approve_run: 0012's version (signature unchanged), gamemaster check.
-- CREATE OR REPLACE keeps the existing grants.
-- ---------------------------------------------------------------------------

create or replace function public.create_reward(
  p_name        text,
  p_description text,
  p_value_cents integer,
  p_fulfillment text,
  p_quest_key   text,
  p_game        text default null,
  p_kind        text default 'food'
)
returns public.rewards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_kind   text := coalesce(nullif(btrim(p_kind), ''), 'food');
  v_circle uuid;
  v_reward public.rewards;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if v_kind not in ('food', 'game_credit') then
    raise exception 'unknown reward kind' using errcode = '22023';
  end if;

  select circle_id into v_circle from public.circle_members where user_id = v_uid;
  if v_circle is null then
    raise exception 'join a squad first' using errcode = 'P0002';
  end if;
  if not public.is_gamemaster(v_circle) then
    raise exception 'only a GameMaster can create rewards' using errcode = '42501';
  end if;

  -- Table checks enforce name length, fulfillment, quest_key format, game,
  -- game-required-for-game_credit and value_cents >= 0; surface them as one
  -- friendly invalid-input error.
  begin
    insert into public.rewards
      (circle_id, name, description, kind, game, value_cents, fulfillment, quest_key, created_by)
    values
      (v_circle, btrim(p_name), coalesce(btrim(p_description), ''), v_kind,
       nullif(btrim(p_game), ''), p_value_cents, p_fulfillment,
       nullif(btrim(p_quest_key), ''), v_uid)
    returning * into v_reward;
  exception when check_violation or not_null_violation then
    raise exception 'invalid reward' using errcode = '22023';
  end;

  return v_reward;
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_earning_fulfilled: 0012's version (signature unchanged). A gamemaster
-- in the reward's circle may mark any earning fulfilled; the earner may still
-- fulfill their own provider-delivered earning. Manual: gamemasters only.
-- CREATE OR REPLACE keeps the existing grants.
-- ---------------------------------------------------------------------------
