-- UPONLY-1: reward thumbnails — store the shop art (e.g. Fortnite item
-- image) on the reward so the rewards page can show it instead of a generic
-- sprite. Idempotent: IF NOT EXISTS skips cleanly on re-apply.
-- No grants needed: the column inherits the table-level grants on
-- public.rewards (authenticated: select; service_role: select/insert/update).

alter table public.rewards
  add column if not exists image_url text
  check (image_url is null or image_url like 'https://%');

-- ---------------------------------------------------------------------------
-- create_reward: 0014's version (behavior) plus p_image_url. Adding a param
-- changes the signature, so CREATE OR REPLACE would leave the old overload
-- behind — drop it first, then re-apply 0012's least-privilege grants.
-- ---------------------------------------------------------------------------
drop function if exists public.create_reward(text, text, integer, text, text, text, text);
-- Also drop the new signature so a re-applied migration starts clean.
drop function if exists public.create_reward(text, text, integer, text, text, text, text, text);

create function public.create_reward(
  p_name        text,
  p_description text,
  p_value_cents integer,
  p_fulfillment text,
  p_quest_key   text,
  p_game        text default null,
  p_kind        text default 'food',
  p_image_url   text default null
)
returns public.rewards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_kind      text := coalesce(nullif(btrim(p_kind), ''), 'food');
  v_circle    uuid;
  v_image_url text := nullif(btrim(p_image_url), '');
  v_reward    public.rewards;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if v_kind not in ('food', 'game_credit') then
    raise exception 'unknown reward kind' using errcode = '22023';
  end if;

  if v_image_url is not null and v_image_url not like 'https://%' then
    raise exception 'invalid reward image' using errcode = '22023';
  end if;

  select circle_id into v_circle from public.circle_members where user_id = v_uid;
  if v_circle is null then
    raise exception 'join a squad first' using errcode = 'P0002';
  end if;
  if not public.is_gamemaster(v_circle) then
    raise exception 'only a GameMaster can create rewards' using errcode = '42501';
  end if;

  -- Table checks enforce name length, fulfillment, quest_key format, game,
  -- game-required-for-game_credit, value_cents >= 0, and the https image
  -- rule; surface them as one friendly invalid-input error.
  begin
    insert into public.rewards
      (circle_id, name, description, kind, game, value_cents, fulfillment, quest_key, image_url, created_by)
    values
      (v_circle, btrim(p_name), coalesce(btrim(p_description), ''), v_kind,
       nullif(btrim(p_game), ''), p_value_cents, p_fulfillment,
       nullif(btrim(p_quest_key), ''), v_image_url, v_uid)
    returning * into v_reward;
  exception when check_violation or not_null_violation then
    raise exception 'invalid reward' using errcode = '22023';
  end;

  return v_reward;
end;
$$;

-- Least-privilege grants (0012's pattern): functions are EXECUTE-able by
-- PUBLIC by default, so lock down the re-created RPC.
revoke execute on function
  public.create_reward(text, text, integer, text, text, text, text, text)
  from public, anon, authenticated;

grant execute on function
  public.create_reward(text, text, integer, text, text, text, text, text)
  to authenticated, service_role;
