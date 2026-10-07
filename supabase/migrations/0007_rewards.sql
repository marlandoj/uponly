-- UpOnly — 0007_rewards: household food rewards. A parent defines a reward for
-- their circle (optionally attached to one catalog quest), a kid completes the
-- quest, and the reward drops instantly. Fulfillment is MOCKED in app code
-- (lib/fulfillment/) — no real charges, no real provider APIs.
--
-- Quests are not a table: they are the static catalog in lib/quests.ts, and
-- quest_runs.quest_key points into it. rewards.quest_key does the same:
--   quest_key = 'dishes'  → earned by completing a Dish Dragon run
--   quest_key is null     → earned by completing any quest
--
-- Lifecycle of an earning:  earned --(provider or parent)--> fulfilled
--   * mock-tremendous / mock-doordash: the route handler fulfills right after
--     record_reward_earning, then calls mark_earning_fulfilled
--   * manual: stays 'earned' until a parent marks it fulfilled from the queue
--
-- Same Data API policy as 0001: revoke to zero, grant only what RLS allows.
-- Clients never write these tables directly — every write is a SECURITY
-- DEFINER RPC that re-checks circle membership / ownership server-side.

-- ---------------------------------------------------------------------------
-- rewards
-- ---------------------------------------------------------------------------
create table public.rewards (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references public.circles (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 280),
  -- FOOD only for now; widen this check (not the app) when a new kind ships.
  kind        text not null default 'food' check (kind = 'food'),
  value_cents integer check (value_cents >= 0),
  fulfillment text not null
                check (fulfillment in ('mock-tremendous', 'mock-doordash', 'manual')),
  quest_key   text check (quest_key ~ '^[a-z0-9-]{1,40}$'),
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index rewards_circle_quest on public.rewards (circle_id, quest_key);

alter table public.rewards enable row level security;

create policy "rewards: circle members read"
  on public.rewards for select to authenticated
  using (public.is_circle_member(circle_id));

-- ---------------------------------------------------------------------------
-- reward_earnings
-- ---------------------------------------------------------------------------
create table public.reward_earnings (
  id              uuid primary key default gen_random_uuid(),
  reward_id       uuid not null references public.rewards (id) on delete cascade,
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  quest_run_id    uuid not null references public.quest_runs (id) on delete cascade,
  status          text not null default 'earned' check (status in ('earned', 'fulfilled')),
  earned_at       timestamptz not null default now(),
  fulfilled_at    timestamptz,
  -- provider reference: mock gift code, mock order id, or 'manual-parent'
  fulfillment_ref text check (char_length(fulfillment_ref) between 1 and 120),
  constraint reward_earnings_fulfilled_has_ref
    check (status <> 'fulfilled' or (fulfilled_at is not null and fulfillment_ref is not null))
);

-- One earning per reward per quest run: retries of the photo route are no-ops.
create unique index reward_earnings_one_per_run
  on public.reward_earnings (reward_id, quest_run_id);

create index reward_earnings_profile_earned
  on public.reward_earnings (profile_id, earned_at desc);

alter table public.reward_earnings enable row level security;

create policy "reward_earnings: owner read"
  on public.reward_earnings for select to authenticated
  using (profile_id = (select auth.uid()));

-- The parent's fulfillment queue lists every earning in the household.
-- (rewards' own RLS already limits the subquery to the caller's circle.)
create policy "reward_earnings: circle members read"
  on public.reward_earnings for select to authenticated
  using (exists (
    select 1 from public.rewards r
    where r.id = reward_id and public.is_circle_member(r.circle_id)
  ));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on table public.rewards, public.reward_earnings from anon, authenticated, service_role;
grant select on table public.rewards, public.reward_earnings to authenticated;
grant select, insert, update on table public.rewards, public.reward_earnings to service_role;

-- ---------------------------------------------------------------------------
-- create_reward: a circle member adds a reward to their own circle.
-- ---------------------------------------------------------------------------
create function public.create_reward(
  p_name        text,
  p_description text,
  p_value_cents integer,
  p_fulfillment text,
  p_quest_key   text
)
returns public.rewards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_circle uuid;
  v_reward public.rewards;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select circle_id into v_circle from public.circle_members where user_id = v_uid;
  if v_circle is null then
    raise exception 'join a circle first' using errcode = 'P0002';
  end if;

  -- Table checks enforce name length, fulfillment, quest_key format and
  -- value_cents >= 0; surface them as one friendly invalid-input error.
  begin
    insert into public.rewards
      (circle_id, name, description, value_cents, fulfillment, quest_key, created_by)
    values
      (v_circle, btrim(p_name), coalesce(btrim(p_description), ''), p_value_cents,
       p_fulfillment, nullif(btrim(p_quest_key), ''), v_uid)
    returning * into v_reward;
  exception when check_violation or not_null_violation then
    raise exception 'invalid reward' using errcode = '22023';
  end;

  return v_reward;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_reward_earning: the kid who completed the run earns the reward.
-- Idempotent per (reward, run).
-- ---------------------------------------------------------------------------
create function public.record_reward_earning(p_reward_id uuid, p_run_id uuid)
returns public.reward_earnings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_run     public.quest_runs;
  v_reward  public.rewards;
  v_earning public.reward_earnings;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_run from public.quest_runs
   where id = p_run_id and user_id = v_uid;
  if v_run.id is null or v_run.status <> 'completed' then
    raise exception 'only your completed quests earn rewards' using errcode = '55000';
  end if;

  select * into v_reward from public.rewards
   where id = p_reward_id and circle_id = v_run.circle_id;
  if v_reward.id is null then
    raise exception 'no such reward in this circle' using errcode = 'P0002';
  end if;
  if v_reward.quest_key is not null and v_reward.quest_key <> v_run.quest_key then
    raise exception 'this reward is for a different quest' using errcode = '22023';
  end if;

  insert into public.reward_earnings (reward_id, profile_id, quest_run_id)
  values (v_reward.id, v_uid, v_run.id)
  on conflict (reward_id, quest_run_id) do nothing
  returning * into v_earning;

  if v_earning.id is null then
    select * into v_earning from public.reward_earnings
     where reward_id = v_reward.id and quest_run_id = v_run.id;
  end if;
  return v_earning;
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_earning_fulfilled: the earner (auto-fulfillment in the route handler)
-- or any member of the reward's circle (a parent fulfilling for the household).
-- Idempotent: an already-fulfilled earning is returned unchanged.
-- ---------------------------------------------------------------------------
create function public.mark_earning_fulfilled(p_earning_id uuid, p_fulfillment_ref text)
returns public.reward_earnings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_ref     text := btrim(p_fulfillment_ref);
  v_earning public.reward_earnings;
  v_circle  uuid;
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
  select circle_id into v_circle from public.rewards where id = v_earning.reward_id;

  if v_earning.id is null or not (
    v_earning.profile_id = v_uid
    or exists (select 1 from public.circle_members
                where circle_id = v_circle and user_id = v_uid)
  ) then
    raise exception 'no such earning in your circle' using errcode = 'P0002';
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

revoke execute on function
  public.create_reward(text, text, integer, text, text),
  public.record_reward_earning(uuid, uuid),
  public.mark_earning_fulfilled(uuid, text)
  from public, anon, authenticated;

grant execute on function
  public.create_reward(text, text, integer, text, text),
  public.record_reward_earning(uuid, uuid),
  public.mark_earning_fulfilled(uuid, text)
  to authenticated, service_role;
