-- UpOnly — 0008_game_rewards: chores → game loot. Rewards gain a second kind,
-- 'game_credit' (V-Bucks, Robux, Minecoins, a Fortnite shop item), alongside
-- 'food'. Same earn engine: a game credit is still a row in rewards, earned by
-- record_reward_earning and fulfilled by its `fulfillment` provider (in practice
-- mock-tremendous, a mock gift card). There is NO in-game purchasing — no
-- Epic / Roblox / Microsoft API is called, here or in app code.
--
-- Profiles gain an optional gamer tag and the games a kid plays. These are
-- labels for the parent ("Loot bound for: <tag>"), never looked up anywhere.
--
-- No new tables, so RLS is unchanged (rewards / profiles policies from 0001 and
-- 0007 already cover the new columns; table-level SELECT grants include them).
-- Writes stay RPC-only: profiles keeps its display_name-only UPDATE grant, and
-- the new columns are written through set_gamer_profile below.

-- ---------------------------------------------------------------------------
-- profiles: gamer tag + games played
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column gamer_tag text check (char_length(gamer_tag) between 1 and 32),
  add column games     text[] not null default '{}'
    check (games <@ array['Fortnite', 'Roblox', 'Minecraft', 'Other']::text[]);

-- ---------------------------------------------------------------------------
-- rewards: kind widens to game_credit; game says which game it's for
-- ---------------------------------------------------------------------------
alter table public.rewards
  drop constraint rewards_kind_check,
  add constraint rewards_kind_check check (kind in ('food', 'game_credit')),
  add column game text check (game in ('Fortnite', 'Roblox', 'Minecraft', 'Other')),
  add constraint rewards_game_credit_has_game check (kind <> 'game_credit' or game is not null);

-- ---------------------------------------------------------------------------
-- create_reward: now takes p_game / p_kind. Both default (food, no game), so
-- callers passing only the 0007 arguments by name keep working. Dropped and
-- recreated rather than overloaded: two candidates for a 5-argument call would
-- be ambiguous for PostgREST. DROP takes the old grants with it.
-- ---------------------------------------------------------------------------
drop function public.create_reward(text, text, integer, text, text);

create function public.create_reward(
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
-- set_gamer_profile: a user sets their own gamer tag and games. Empty tag
-- clears it; games are de-duplicated and must come from the fixed list.
-- ---------------------------------------------------------------------------
create function public.set_gamer_profile(p_gamer_tag text, p_games text[])
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  begin
    update public.profiles
       set gamer_tag = nullif(btrim(p_gamer_tag), ''),
           games = coalesce(
             (select array_agg(distinct g order by g) from unnest(p_games) as g),
             '{}')
     where id = v_uid
    returning * into v_profile;
  exception when check_violation then
    raise exception 'gamer tag must be 1-32 characters and games from the list' using errcode = '22023';
  end;

  if v_profile.id is null then
    raise exception 'no profile' using errcode = 'P0002';
  end if;
  return v_profile;
end;
$$;

revoke execute on function
  public.create_reward(text, text, integer, text, text, text, text),
  public.set_gamer_profile(text, text[])
  from public, anon, authenticated;

grant execute on function
  public.create_reward(text, text, integer, text, text, text, text),
  public.set_gamer_profile(text, text[])
  to authenticated, service_role;
