-- UpOnly — 0012_household_roles: parents and kids.
--
--   * circle_members.household_role: 'parent' | 'kid', declared when creating
--     or joining a circle. Separate from `role` ('owner' | 'member'), which is
--     about who made the circle and stays untouched.
--   * Existing owners are backfilled to 'parent' (they set the circle up);
--     everyone else stays 'kid' (the column default).
--   * Parents approve quest finishes and control loot: approve_run,
--     create_reward and manual mark_earning_fulfilled now require a parent.
--     Kids still start and finish quests; parents can do chores too.
--   * Not gated: mark_run_ai_approved (the player's own AI fast path),
--     record_reward_earning (already needs an approved run), and the earner's
--     own auto-fulfillment through a provider (mock gift card / order) on that
--     fast path. The RPCs are the real gate; the UI only reflects it.
--
-- Same Data API policy as 0001: revoke to zero, grant only what is needed.
-- The new column is covered by the existing circle_members SELECT grant and
-- "members read roster" policy; writes stay RPC-only. No RLS changes.
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- Column + check
-- ---------------------------------------------------------------------------
alter table public.circle_members
  add column if not exists household_role text not null default 'kid';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'circle_members_household_role_check'
       and conrelid = 'public.circle_members'::regclass
  ) then
    alter table public.circle_members
      add constraint circle_members_household_role_check
      check (household_role in ('parent', 'kid'));
  end if;
end;
$$;

-- Whoever started a circle is its first parent. Re-running only touches
-- owners still at the default.
update public.circle_members
   set household_role = 'parent'
 where role = 'owner' and household_role = 'kid';

-- ---------------------------------------------------------------------------
-- is_circle_parent: is the caller a parent in this circle? Called from the
-- SECURITY DEFINER RPCs below (which read circle_members as the owner), so it
-- needs no definer rights of its own.
-- ---------------------------------------------------------------------------
create or replace function public.is_circle_parent(p_circle_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.circle_members m
    where m.circle_id = p_circle_id
      and m.user_id = (select auth.uid())
      and m.household_role = 'parent'
  );
$$;

-- ---------------------------------------------------------------------------
-- create_circle / join_circle: + household role. The 1-arg versions are
-- dropped (an overload would make 1-arg calls ambiguous for PostgREST); the
-- defaults keep 1-arg calls working — a creator is a parent, a joiner a kid.
-- DROP takes the old grants with it; they are re-applied below.
-- ---------------------------------------------------------------------------
drop function if exists public.create_circle(text);
drop function if exists public.join_circle(text);

create or replace function public.create_circle(p_name text, p_household_role text default 'parent')
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
  if p_household_role is null or p_household_role not in ('parent', 'kid') then
    raise exception 'household role must be parent or kid' using errcode = '22023';
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

  insert into public.circle_members (circle_id, user_id, role, household_role)
  values (v_circle.id, v_uid, 'owner', p_household_role);

  return v_circle;
end;
$$;

create or replace function public.join_circle(p_code text, p_household_role text default 'kid')
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
  if p_household_role is null or p_household_role not in ('parent', 'kid') then
    raise exception 'household role must be parent or kid' using errcode = '22023';
  end if;

  select * into v_circle
  from public.circles
  where join_code = upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));

  if v_circle.id is null then
    raise exception 'no circle with that code' using errcode = 'P0002';
  end if;

  -- Idempotent re-join; an existing member keeps the role they joined with.
  insert into public.circle_members (circle_id, user_id, role, household_role)
  values (v_circle.id, v_uid, 'member', p_household_role)
  on conflict (circle_id, user_id) do nothing;

  return v_circle;
exception
  when unique_violation then
    raise exception 'already in a circle' using errcode = '23505';
end;
$$;

-- ---------------------------------------------------------------------------
-- approve_run: 0010's version (signature unchanged) plus a parent check after
-- the self-review check. CREATE OR REPLACE keeps 0010's grants.
-- ---------------------------------------------------------------------------
create or replace function public.approve_run(p_run_id uuid, p_approve boolean, p_reason text default null)
returns public.quest_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_reason text := nullif(btrim(p_reason), '');
  v_run    public.quest_runs;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_approve is null then
    raise exception 'approve must be true or false' using errcode = '22023';
  end if;
  if not p_approve and (v_reason is null or char_length(v_reason) > 300) then
    raise exception 'tell them what to fix (1–300 characters)' using errcode = '22023';
  end if;

  select * into v_run from public.quest_runs where id = p_run_id for update;
  if v_run.id is null or not public.is_circle_member(v_run.circle_id) then
    raise exception 'quest not found in your circle' using errcode = 'P0002';
  end if;
  if v_run.user_id = v_uid then
    raise exception 'someone else in your circle has to review your quest' using errcode = '42501';
  end if;
  if not public.is_circle_parent(v_run.circle_id) then
    raise exception 'only a parent can approve a quest' using errcode = '42501';
  end if;
  if v_run.status <> 'completed' or v_run.approval_status <> 'pending' then
    raise exception 'this quest is not waiting for review' using errcode = '55000';
  end if;

  if p_approve then
    update public.quest_runs
       set approval_status = 'approved', approved_by = v_uid, approved_at = now(),
           rejection_reason = null
     where id = p_run_id
    returning * into v_run;
  else
    begin
      update public.quest_runs
         set approval_status = 'rejected', status = 'active', rejection_reason = v_reason,
             verification = null, verification_reason = null, verified_at = null,
             rating_code = null, shared_at = null
       where id = p_run_id
      returning * into v_run;
    exception
      when unique_violation then
        raise exception 'they already have another quest going — ask for a redo once it is done'
          using errcode = '55000';
    end;
  end if;

  return v_run;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_reward: 0008's version (signature unchanged), parents only.
-- CREATE OR REPLACE keeps 0008's grants.
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
    raise exception 'join a circle first' using errcode = 'P0002';
  end if;
  if not public.is_circle_parent(v_circle) then
    raise exception 'only a parent can create rewards' using errcode = '42501';
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
-- mark_earning_fulfilled: 0007's version (signature unchanged). A parent in
-- the reward's circle may mark any earning fulfilled. The earner may still
-- fulfill their own earning when a provider delivers it (mock gift card /
-- order) — that is the AI fast path's auto-fulfillment in the player's
-- session. Manual rewards are handed over in real life: parents only.
-- CREATE OR REPLACE keeps 0007's grants.
-- ---------------------------------------------------------------------------
create or replace function public.mark_earning_fulfilled(p_earning_id uuid, p_fulfillment_ref text)
returns public.reward_earnings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_ref     text := btrim(p_fulfillment_ref);
  v_earning public.reward_earnings;
  v_reward  public.rewards;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_ref is null or char_length(v_ref) not between 1 and 120 then
    raise exception 'fulfillment reference must be 1-120 characters' using errcode = '22023';
  end if;

  select * into v_earning from public.reward_earnings
   where id = p_earning_id
   for update;
  select * into v_reward from public.rewards where id = v_earning.reward_id;

  if v_earning.id is null or not (
    v_earning.profile_id = v_uid
    or public.is_circle_member(v_reward.circle_id)
  ) then
    raise exception 'no such earning in your circle' using errcode = 'P0002';
  end if;
  if not public.is_circle_parent(v_reward.circle_id)
     and not (v_earning.profile_id = v_uid and v_reward.fulfillment <> 'manual') then
    raise exception 'only a parent can mark a reward fulfilled' using errcode = '42501';
  end if;

  if v_earning.status = 'fulfilled' then
    return v_earning;
  end if;

  update public.reward_earnings
     set status = 'fulfilled', fulfilled_at = now(), fulfillment_ref = v_ref
   where id = p_earning_id
  returning * into v_earning;

  return v_earning;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Functions are EXECUTE-able by PUBLIC by default; lock down the new
-- helper and the re-created circle RPCs. approve_run, create_reward and
-- mark_earning_fulfilled keep their grants through CREATE OR REPLACE; they are
-- restated here so this file alone shows the final state.
-- ---------------------------------------------------------------------------
revoke execute on function
  public.is_circle_parent(uuid),
  public.create_circle(text, text),
  public.join_circle(text, text),
  public.approve_run(uuid, boolean, text),
  public.create_reward(text, text, integer, text, text, text, text),
  public.mark_earning_fulfilled(uuid, text)
  from public, anon, authenticated;

grant execute on function
  public.is_circle_parent(uuid),
  public.create_circle(text, text),
  public.join_circle(text, text),
  public.approve_run(uuid, boolean, text),
  public.create_reward(text, text, integer, text, text, text, text),
  public.mark_earning_fulfilled(uuid, text)
  to authenticated, service_role;
