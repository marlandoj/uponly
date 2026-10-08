-- UpOnly — 0009_visual_verification: video evidence, giver approval and run
-- comments.
--
--   * approval_mode (chosen at start): 'ai_instant' — an AI 'pass' approves the
--     run and drops rewards immediately; anything else waits for a giver.
--     'giver_approves' — every finish waits for a giver.
--   * approval_status: pending → approved | rejected. A giver is any other
--     member of the run's circle (parent/kid roles are deferred). Rejecting
--     sends the run back to 'active' so the player re-shoots the after photo;
--     complete_quest puts it back to pending.
--   * Evidence may be a JPEG (≤10 MB) or an MP4/WebM clip (≤50 MB). Paths stay
--     "<uid>/<run>/{before,after}.<ext>"; the RPCs find whichever was uploaded.
--   * Rewards are only earned once a run is approved (record_reward_earning is
--     re-created with that gate, and so a giver can record the player's loot).
--   * run_comments: circle-mates talk about a run on its page.
--
-- Same Data API policy as 0001: revoke to zero, grant only what RLS allows.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.quest_runs
  add column approval_mode   text not null default 'ai_instant'
    check (approval_mode in ('ai_instant', 'giver_approves')),
  add column approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column approved_by     uuid references public.profiles (id),
  add column approved_at     timestamptz;

-- Completions from before this migration already earned their rewards.
update public.quest_runs set approval_status = 'approved' where status = 'completed';

-- ---------------------------------------------------------------------------
-- quest_runs: circle-mates can read runs (a giver must see pending finishes).
-- The owner policy stays. Writes are still RPC-only.
-- ---------------------------------------------------------------------------
create policy "quest_runs: circle read"
  on public.quest_runs for select to authenticated
  using (public.shares_circle_with(user_id));

-- ---------------------------------------------------------------------------
-- run_comments
-- ---------------------------------------------------------------------------
create table public.run_comments (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid not null references public.quest_runs (id) on delete cascade,
  author_id  uuid not null references public.profiles (id),
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index run_comments_run_created on public.run_comments (run_id, created_at);

alter table public.run_comments enable row level security;

create policy "run_comments: circle members read"
  on public.run_comments for select to authenticated
  using (exists (
    select 1 from public.quest_runs r
     where r.id = run_comments.run_id and public.is_circle_member(r.circle_id)
  ));

create policy "run_comments: circle members post as themselves"
  on public.run_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.quest_runs r
       where r.id = run_comments.run_id and public.is_circle_member(r.circle_id)
    )
  );

revoke all on table public.run_comments from anon, authenticated, service_role;
grant select, insert on table public.run_comments to authenticated;
grant select, insert, update, delete on table public.run_comments to service_role;

-- ---------------------------------------------------------------------------
-- Storage: allow short clips in the evidence bucket.
-- ---------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = '{image/jpeg,image/webp,video/mp4,video/webm}'
 where id = 'evidence';

-- ---------------------------------------------------------------------------
-- evidence_object_path: the uploaded object for "<uid>/<run>/<kind>", trying
-- .jpg, .mp4, .webm. If a re-shoot left more than one, the newest wins.
-- Internal helper for the SECURITY DEFINER RPCs below; not client-callable.
-- ---------------------------------------------------------------------------
create function public.evidence_object_path(p_uid uuid, p_run_id uuid, p_kind text)
returns text
language sql
stable
set search_path = ''
as $$
  select o.name
    from storage.objects o
    join (values ('jpg', 1), ('mp4', 2), ('webm', 3)) as e (ext, pref)
      on o.name = p_uid::text || '/' || p_run_id::text || '/' || p_kind || '.' || e.ext
   where o.bucket_id = 'evidence'
   order by o.updated_at desc nulls last, e.pref
   limit 1;
$$;

revoke execute on function public.evidence_object_path(uuid, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- start_quest: + approval mode. The 3-arg version is dropped (an overload
-- would make 3-arg calls ambiguous); the default keeps 3-arg calls working.
-- ---------------------------------------------------------------------------
drop function public.start_quest(text, text, text);

create function public.start_quest(
  p_quest_key text,
  p_title text,
  p_finish_condition text,
  p_approval_mode text default 'ai_instant'
)
returns public.quest_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_circle uuid;
  v_run    public.quest_runs;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_approval_mode is null or p_approval_mode not in ('ai_instant', 'giver_approves') then
    raise exception 'approval mode must be ai_instant or giver_approves' using errcode = '22023';
  end if;

  select circle_id into v_circle from public.circle_members where user_id = v_uid;
  if v_circle is null then
    raise exception 'join a circle first' using errcode = 'P0002';
  end if;

  insert into public.quest_runs (user_id, circle_id, quest_key, title, finish_condition, approval_mode)
  values (v_uid, v_circle, p_quest_key, btrim(p_title), btrim(p_finish_condition), p_approval_mode)
  returning * into v_run;

  return v_run;
exception
  when unique_violation then
    raise exception 'you already have a quest in progress' using errcode = '23505';
end;
$$;

revoke execute on function public.start_quest(text, text, text, text) from public, anon, authenticated;
grant execute on function public.start_quest(text, text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- record_before_photo: any evidence extension (CREATE OR REPLACE keeps grants)
-- ---------------------------------------------------------------------------
create or replace function public.record_before_photo(p_run_id uuid)
returns public.quest_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_path text;
  v_run  public.quest_runs;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  v_path := public.evidence_object_path(v_uid, p_run_id, 'before');
  if v_path is null then
    raise exception 'before photo not uploaded' using errcode = 'P0002';
  end if;

  update public.quest_runs
     set status = 'active', before_path = v_path, started_at = now()
   where id = p_run_id and user_id = v_uid and status = 'draft'
  returning * into v_run;

  if v_run.id is null then
    raise exception 'quest is not waiting for a before photo' using errcode = '55000';
  end if;
  return v_run;
end;
$$;

-- ---------------------------------------------------------------------------
-- complete_quest: 0005's version with any evidence extension, approval reset,
-- and a resubmit path. A run coming back from a giver's "ask to redo" already
-- has credited set: it keeps its original credit/XP/streak/completed_at and
-- only swaps the after evidence — a redo is not a second completion.
-- ---------------------------------------------------------------------------
create or replace function public.complete_quest(p_run_id uuid)
returns public.quest_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_path     text;
  v_run      public.quest_runs;
  v_today    integer;
  v_credited boolean;
  v_xp       integer;
  v_streak   integer;
  v_last     date;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_run from public.quest_runs
   where id = p_run_id and user_id = v_uid
   for update;
  if v_run.id is null or v_run.status <> 'active' then
    raise exception 'quest is not in progress' using errcode = '55000';
  end if;
  if now() < v_run.started_at + interval '4 minutes' then
    raise exception 'quests take at least 4 minutes' using errcode = '22023';
  end if;
  v_path := public.evidence_object_path(v_uid, p_run_id, 'after');
  if v_path is null then
    raise exception 'after photo not uploaded' using errcode = 'P0002';
  end if;

  -- Redo after a giver rejected it: new evidence, fresh review, nothing re-awarded.
  if v_run.credited is not null then
    update public.quest_runs
       set status = 'completed', after_path = v_path,
           approval_status = 'pending', approved_by = null, approved_at = null,
           verification = null, verification_reason = null, verified_at = null
     where id = p_run_id
    returning * into v_run;
    return v_run;
  end if;

  -- Lock the profile so the daily count and XP update can't race a rating.
  perform 1 from public.profiles where id = v_uid for update;

  select count(*) into v_today
    from public.quest_runs
   where user_id = v_uid and credited
     and completed_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_credited := v_today < 3;

  -- Streak: consecutive UTC days with a completed quest. Any completion
  -- counts (even uncredited bonus quests) — the streak rewards showing up.
  select streak, last_quest_date into v_streak, v_last
    from public.profiles where id = v_uid;
  v_streak := case
    when v_last = current_date then v_streak         -- already counted today
    when v_last = current_date - 1 then v_streak + 1 -- streak continues
    else 1                                           -- new streak (or broken)
  end;

  update public.profiles
     set xp = xp + case when v_credited then 10 else 0 end,
         quests_completed = quests_completed + 1,
         streak = v_streak,
         last_quest_date = current_date
   where id = v_uid
  returning xp into v_xp;

  update public.quest_runs
     set status = 'completed', after_path = v_path, completed_at = now(),
         credited = v_credited,
         completion_xp = case when v_credited then 10 else 0 end,
         xp_after_completion = v_xp,
         approval_status = 'pending', approved_by = null, approved_at = null
   where id = p_run_id
  returning * into v_run;

  return v_run;
end;
$$;

-- ---------------------------------------------------------------------------
-- approve_run: a giver (another member of the run's circle) approves or asks
-- for a redo. A redo sends the run back to 'active'; the AI verdict and any
-- celebration code are cleared because both describe the rejected evidence
-- (and the table checks tie them to status = 'completed').
-- ---------------------------------------------------------------------------
create function public.approve_run(p_run_id uuid, p_approve boolean)
returns public.quest_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_run public.quest_runs;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_approve is null then
    raise exception 'approve must be true or false' using errcode = '22023';
  end if;

  select * into v_run from public.quest_runs where id = p_run_id for update;
  if v_run.id is null or not public.is_circle_member(v_run.circle_id) then
    raise exception 'quest not found in your circle' using errcode = 'P0002';
  end if;
  if v_run.user_id = v_uid then
    raise exception 'someone else in your circle has to review your quest' using errcode = '42501';
  end if;
  if v_run.status <> 'completed' or v_run.approval_status <> 'pending' then
    raise exception 'this quest is not waiting for review' using errcode = '55000';
  end if;

  if p_approve then
    update public.quest_runs
       set approval_status = 'approved', approved_by = v_uid, approved_at = now()
     where id = p_run_id
    returning * into v_run;
  else
    begin
      update public.quest_runs
         set approval_status = 'rejected', status = 'active',
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
-- mark_run_ai_approved: the owner's photo route, after an AI 'pass' on an
-- ai_instant run. The verdict is service-role-written, so the player can't
-- forge the pass that this checks.
-- ---------------------------------------------------------------------------
create function public.mark_run_ai_approved(p_run_id uuid)
returns public.quest_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_run public.quest_runs;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.quest_runs
     set approval_status = 'approved', approved_at = now()
   where id = p_run_id and user_id = v_uid
     and status = 'completed' and approval_mode = 'ai_instant'
     and verification = 'pass' and approval_status = 'pending'
  returning * into v_run;

  if v_run.id is null then
    raise exception 'quest is not eligible for instant approval' using errcode = '55000';
  end if;
  return v_run;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_reward_earning: only approved runs earn. Callable by the player (AI
-- instant path) or a circle-mate (the giver who just approved); the earning
-- always belongs to the run's player. CREATE OR REPLACE keeps the grants.
-- ---------------------------------------------------------------------------
create or replace function public.record_reward_earning(p_reward_id uuid, p_run_id uuid)
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

  select * into v_run from public.quest_runs where id = p_run_id;
  if v_run.id is null
     or not (v_run.user_id = v_uid or public.is_circle_member(v_run.circle_id))
     or v_run.status <> 'completed'
     or v_run.approval_status <> 'approved' then
    raise exception 'only approved quests in your circle earn rewards' using errcode = '55000';
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
  values (v_reward.id, v_run.user_id, v_run.id)
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
-- Grants for the new RPCs
-- ---------------------------------------------------------------------------
revoke execute on function
  public.approve_run(uuid, boolean),
  public.mark_run_ai_approved(uuid)
  from public, anon, authenticated;

grant execute on function
  public.approve_run(uuid, boolean),
  public.mark_run_ai_approved(uuid)
  to authenticated, service_role;
