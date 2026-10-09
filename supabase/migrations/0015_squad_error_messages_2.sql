-- UPONLY-1: squad wording in remaining user-facing DB error messages.
-- Recreates rate_quest / record_reward_earning / start_quest / approve_run /
-- mark_earning_fulfilled with "squad" phrasing (was "circle"). Behavior unchanged.
-- Idempotent.

CREATE OR REPLACE FUNCTION public.rate_quest(p_code text, p_rating integer)
 RETURNS quest_ratings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid       uuid := auth.uid();
  v_run       public.quest_runs;
  v_joined    timestamptz;
  v_reason    text;
  v_counted   integer;
  v_today     integer;
  v_xp        integer := 0;
  v_delta     numeric := 0;
  v_before    numeric;
  v_after     numeric;
  v_xp_after  integer;
  v_fold      boolean := false;
  v_rating    public.quest_ratings;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_rating is null or p_rating not in (3, 4, 5) then
    raise exception 'rating must be 3, 4 or 5' using errcode = '22023';
  end if;

  -- Lock the run: serializes ratings on it so the 2-per-quest cap holds.
  select * into v_run from public.quest_runs
   where rating_code = upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'))
     and status = 'completed'
   for update;

  select joined_at into v_joined
    from public.circle_members
   where user_id = v_uid and circle_id = v_run.circle_id;

  if v_run.id is null or v_joined is null then
    raise exception 'no celebration with that code in your squad' using errcode = 'P0002';
  end if;
  if v_run.user_id = v_uid then
    raise exception 'you can''t rate your own quest' using errcode = '42501';
  end if;
  if v_joined > v_run.started_at - interval '24 hours' then
    raise exception 'you can rate quests that start 24 hours after you joined the squad'
      using errcode = '42501';
  end if;
  if exists (select 1 from public.quest_ratings where run_id = v_run.id and rater_id = v_uid) then
    raise exception 'you already celebrated this quest' using errcode = '23505';
  end if;

  -- Lock both profiles in id order (no deadlock with a reverse rating).
  perform 1 from public.profiles where id in (v_uid, v_run.user_id) order by id for update;

  select count(*) into v_counted from public.quest_ratings where run_id = v_run.id and counted;
  select count(*) into v_today
    from public.quest_ratings
   where rater_id = v_uid and counted
     and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';

  v_reason := case
    when not v_run.credited then 'completion_not_credited'
    when v_counted >= 2 then 'completion_rating_cap'
    when v_today >= 5 then 'rater_daily_cap'
  end;

  select level, xp into v_before, v_xp_after from public.profiles where id = v_run.user_id;
  v_after := v_before;

  if v_reason is null then
    v_xp := case p_rating when 3 then 2 when 4 then 4 else 6 end;
    v_delta := (p_rating - 3) * 0.06
               * case when v_run.verification = 'pass' then 1.0 else 0.8 end;
    update public.profiles
       set xp = xp + v_xp,
           score = score + v_delta,
           level = greatest(level, public.level_from_score(score + v_delta))
     where id = v_run.user_id
    returning level, xp into v_after, v_xp_after;

    insert into public.badges (user_id, badge, run_id)
    values (v_run.user_id, 'first_fold', v_run.id)
    on conflict (user_id, badge) do nothing;
    v_fold := found;
  end if;

  insert into public.quest_ratings
    (run_id, rater_id, ratee_id, rating, counted, not_counted_reason,
     xp_awarded, score_delta, level_before, level_after, xp_after, first_fold)
  values
    (v_run.id, v_uid, v_run.user_id, p_rating, v_reason is null, v_reason,
     v_xp, v_delta, v_before, v_after, v_xp_after, v_fold)
  returning * into v_rating;

  return v_rating;
end;
$function$;


CREATE OR REPLACE FUNCTION public.record_reward_earning(p_reward_id uuid, p_run_id uuid)
 RETURNS reward_earnings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid     uuid := auth.uid();
  v_run     public.quest_runs;
  v_reward  public.rewards;
  v_earning public.reward_earnings;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_run from public.quest_runs where id = p_run_id;
  if v_run.id is null
     or not (v_run.user_id = v_uid or public.is_circle_member(v_run.circle_id))
     or v_run.status <> 'completed'
     or v_run.approval_status <> 'approved' then
    raise exception 'only approved quests in your squad earn rewards' using errcode = '55000';
  end if;

  select * into v_reward from public.rewards
   where id = p_reward_id and circle_id = v_run.circle_id;
  if v_reward.id is null then
    raise exception 'no such reward in this squad' using errcode = 'P0002';
  end if;
  if v_reward.quest_key is not null and v_reward.quest_key <> v_run.quest_key then
    raise exception 'this reward is for a different quest' using errcode = '22023';
  end if;

  insert into public.reward_earnings (reward_id, profile_id, quest_run_id)
  values (v_reward.id, v_run.user_id, v_run.id)
  on conflict (reward_id, quest_run_id) do nothing
  returning * into v_earning;

  if v_earning.id is null then
    select * into v_earning from public.reward_earnings
     where reward_id = v_reward.id and quest_run_id = v_run.id;
  end if;
  return v_earning;
end;
$function$;


CREATE OR REPLACE FUNCTION public.start_quest(p_quest_key text, p_title text, p_finish_condition text, p_approval_mode text DEFAULT 'ai_instant'::text, p_chore_size text DEFAULT 'standard'::text)
 RETURNS quest_runs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    raise exception 'join a squad first' using errcode = 'P0002';
  end if;

  insert into public.quest_runs (user_id, circle_id, quest_key, title, finish_condition, approval_mode, chore_size)
  values (v_uid, v_circle, p_quest_key, btrim(p_title), btrim(p_finish_condition), p_approval_mode, v_size)
  returning * into v_run;

  return v_run;
exception
  when unique_violation then
    raise exception 'you already have a quest in progress' using errcode = '23505';
end;
$function$;


CREATE OR REPLACE FUNCTION public.approve_run(p_run_id uuid, p_approve boolean, p_reason text DEFAULT NULL::text)
 RETURNS quest_runs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    raise exception 'quest not found in your squad' using errcode = 'P0002';
  end if;
  if v_run.user_id = v_uid then
    raise exception 'someone else in your squad has to review your quest' using errcode = '42501';
  end if;
  if not public.is_gamemaster(v_run.circle_id) then
    raise exception 'only a GameMaster can approve a quest' using errcode = '42501';
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
$function$;


CREATE OR REPLACE FUNCTION public.mark_earning_fulfilled(p_earning_id uuid, p_fulfillment_ref text)
 RETURNS reward_earnings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    raise exception 'no such earning in your squad' using errcode = 'P0002';
  end if;
  if not public.is_gamemaster(v_reward.circle_id)
     and not (v_earning.profile_id = v_uid and v_reward.fulfillment <> 'manual') then
    raise exception 'only a GameMaster can mark a reward fulfilled' using errcode = '42501';
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
$function$;
