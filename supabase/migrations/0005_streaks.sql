-- 0005: daily streak tracking.
--
-- Streak = consecutive UTC days with at least one completed quest.
-- Maintained inside complete_quest (SECURITY DEFINER) so it can't be
-- forged from the client; profiles stays server-written for streak.

alter table public.profiles
  add column last_quest_date date;

-- Re-create complete_quest with streak maintenance. (Full copy of 0004's
-- version plus the streak block; CREATE OR REPLACE keeps the grants.)
create or replace function public.complete_quest(p_run_id uuid)
returns public.quest_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_path     text := v_uid::text || '/' || p_run_id::text || '/after.jpg';
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
  if not exists (select 1 from storage.objects where bucket_id = 'evidence' and name = v_path) then
    raise exception 'after photo not uploaded' using errcode = 'P0002';
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
         xp_after_completion = v_xp
   where id = p_run_id
  returning * into v_run;

  return v_run;
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_quest_photos: owner removes their evidence photos.
--
-- Verifies ownership, clears the path references, and returns the old paths
-- so the caller can remove the storage objects (owner delete policy).
-- Ratings already given stay — only the photos disappear.
-- ---------------------------------------------------------------------------
create or replace function public.delete_quest_photos(p_run_id uuid)
returns table (before_path text, after_path text)
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

  select * into v_run from public.quest_runs
   where id = p_run_id and user_id = v_uid
   for update;
  if v_run.id is null then
    raise exception 'quest not found' using errcode = 'P0002';
  end if;

  update public.quest_runs
     set before_path = null, after_path = null
   where id = p_run_id;

  return query select v_run.before_path, v_run.after_path;
end;
$$;
