-- UpOnly — 0011_loot_catalog: loot catalog research + chore value tiers.
--
-- game_catalog is a global research cache of what game loot costs: today's
-- Fortnite shop items (from the fortnite-api.com fetch in lib/fortniteShop.ts)
-- plus curated currency packs (Robux, Minecoins). It is filled when a kid saves
-- their games on /profile and read by the parent's loot picker on /rewards/new.
-- DISPLAY ONLY: nothing here buys anything; picking an item creates an ordinary
-- game_credit reward fulfilled as a (mock) gift card.
--
-- quest_runs gains chore_size (quick / standard / big) so a chore carries a
-- suggested reward value; the picker sorts loot by closeness to it.
--
-- NOTE: written against the 3-arg start_quest from 0002_quests.sql. 0009/0010
-- (unmerged at time of writing) redefine start_quest as 4-arg; if they land
-- first, the drop below needs rework.
--
-- Same Data API policy as 0001: revoke to zero, grant only what RLS allows.
-- Clients never write game_catalog directly — upsert_game_catalog is the only
-- write path.

-- ---------------------------------------------------------------------------
-- game_catalog
-- ---------------------------------------------------------------------------
create table public.game_catalog (
  id         uuid primary key default gen_random_uuid(),
  game       text not null check (game in ('Fortnite', 'Roblox', 'Minecraft', 'Other')),
  item_name  text not null,
  item_kind  text not null check (item_kind in ('currency', 'dlc', 'drop')),
  usd_value  numeric(10,2) not null check (usd_value >= 0),
  details    jsonb not null default '{}',
  source     text not null check (source in ('fortnite-api', 'curated')),
  fetched_at timestamptz not null default now(),
  unique (game, item_name)
);

-- The picker loads one or more games and sorts by value.
create index game_catalog_game_value on public.game_catalog (game, usd_value);

alter table public.game_catalog enable row level security;

-- No circle_id (global cache): anyone in a circle may read it.
create policy "game_catalog: circle members read"
  on public.game_catalog for select to authenticated
  using (exists (select 1 from public.circle_members where user_id = (select auth.uid())));

revoke all on table public.game_catalog from anon, authenticated, service_role;
grant select on table public.game_catalog to authenticated;
grant select, insert, update, delete on table public.game_catalog to service_role;

-- ---------------------------------------------------------------------------
-- upsert_game_catalog: p_items is a JSON array of
--   { game, item_name, item_kind, usd_value, details?, source }
-- Upserts on (game, item_name) and refreshes fetched_at. Any invalid element
-- rejects the whole batch. Returns the number of rows processed.
-- ---------------------------------------------------------------------------
create function public.upsert_game_catalog(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_item  jsonb;
  v_name  text;
  v_value text;
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid catalog item' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'invalid catalog item' using errcode = '22023';
    end if;

    v_name  := btrim(v_item ->> 'item_name');
    -- usd_value may arrive as a JSON number or string; validate its text form.
    v_value := v_item ->> 'usd_value';

    if coalesce(v_item ->> 'game', '') not in ('Fortnite', 'Roblox', 'Minecraft', 'Other')
       or coalesce(v_item ->> 'item_kind', '') not in ('currency', 'dlc', 'drop')
       or coalesce(v_item ->> 'source', '') not in ('fortnite-api', 'curated')
       or coalesce(v_name, '') = ''
       or v_value is null
       or v_value !~ '^\d{1,8}(\.\d{1,2})?$'
       or (v_item ? 'details' and jsonb_typeof(v_item -> 'details') not in ('object', 'null')) then
      raise exception 'invalid catalog item' using errcode = '22023';
    end if;

    insert into public.game_catalog (game, item_name, item_kind, usd_value, details, source)
    values (
      v_item ->> 'game',
      v_name,
      v_item ->> 'item_kind',
      v_value::numeric(10,2),
      coalesce(nullif(v_item -> 'details', 'null'::jsonb), '{}'::jsonb),
      v_item ->> 'source'
    )
    on conflict (game, item_name) do update
       set item_kind  = excluded.item_kind,
           usd_value  = excluded.usd_value,
           details    = excluded.details,
           source     = excluded.source,
           fetched_at = now();

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.upsert_game_catalog(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_game_catalog(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- quest_runs: chore size (value tier)
-- ---------------------------------------------------------------------------
alter table public.quest_runs
  add column chore_size text not null default 'standard'
    check (chore_size in ('quick', 'standard', 'big'));

-- ---------------------------------------------------------------------------
-- start_quest: now takes p_chore_size (default 'standard'), so 3-argument
-- callers keep working. Dropped and recreated rather than overloaded (0008
-- pattern): two candidates for a 3-argument call would be ambiguous for
-- PostgREST. DROP takes the old grants with it.
-- ---------------------------------------------------------------------------
-- 0009/0010 (applied to the live DB before this branch) redefined start_quest
-- as 4-arg with p_approval_mode. Reconcile: drop the 4-arg, create a 5-arg
-- carrying both p_approval_mode and p_chore_size.
drop function public.start_quest(text, text, text, text);

create function public.start_quest(
  p_quest_key        text,
  p_title            text,
  p_finish_condition text,
  p_approval_mode    text default 'ai_instant',
  p_chore_size       text default 'standard'
)
returns public.quest_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_size   text := coalesce(nullif(btrim(p_chore_size), ''), 'standard');
  v_circle uuid;
  v_run    public.quest_runs;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_approval_mode is null or p_approval_mode not in ('ai_instant', 'giver_approves') then
    raise exception 'approval mode must be ai_instant or giver_approves' using errcode = '22023';
  end if;
  if v_size not in ('quick', 'standard', 'big') then
    raise exception 'chore size must be quick, standard or big' using errcode = '22023';
  end if;

  select circle_id into v_circle from public.circle_members where user_id = v_uid;
  if v_circle is null then
    raise exception 'join a circle first' using errcode = 'P0002';
  end if;

  insert into public.quest_runs (user_id, circle_id, quest_key, title, finish_condition, approval_mode, chore_size)
  values (v_uid, v_circle, p_quest_key, btrim(p_title), btrim(p_finish_condition), p_approval_mode, v_size)
  returning * into v_run;

  return v_run;
exception
  when unique_violation then
    raise exception 'you already have a quest in progress' using errcode = '23505';
end;
$$;

revoke execute on function public.start_quest(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.start_quest(text, text, text, text, text) to authenticated, service_role;
