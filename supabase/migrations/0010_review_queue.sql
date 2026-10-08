-- UpOnly — 0010_review_queue: structured rejection + resubmit history for the
-- giver review queue.
--
--   * rejection_reason: the giver's "here's what to fix" note (1–300 chars,
--     trimmed). Required to ask for a redo; cleared when a giver approves. It
--     survives the resubmit so the next review can see what was asked.
--   * attempt_no: 1 for the first finish, +1 each time the player resubmits
--     after evidence following a rejection. Nothing else is reset.
--   * approve_run gains p_reason (the 2-arg version is dropped — an overload
--     would make 2-arg calls ambiguous; the default keeps approvals working).
--
-- quest_runs writes stay RPC-only; no table grants change. Same Data API
-- policy as 0001: revoke to zero, grant only what's needed.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.quest_runs
  add column rejection_reason text
    check (rejection_reason is null or char_length(rejection_reason) between 1 and 300),
  add column attempt_no integer not null default 1
    check (attempt_no >= 1);

-- ---------------------------------------------------------------------------
-- complete_quest: 0009's version, plus attempt_no + 1 on a resubmit after a
-- rejection. CREATE OR REPLACE keeps the grants.
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

  -- Redo after a giver rejected it: new evidence, fresh review, next attempt,
  -- nothing re-awarded. rejection_reason stays for the next reviewer.
  if v_run.credited is not null then
    update public.quest_runs
       set status = 'completed', after_path = v_path,
           attempt_no = attempt_no + case when v_run.approval_status = 'rejected' then 1 else 0 end,
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
-- approve_run: 0009's giver-only review, plus a required reason for a redo.
-- Approving clears any earlier reason.
-- ---------------------------------------------------------------------------
drop function public.approve_run(uuid, boolean);

create function public.approve_run(p_run_id uuid, p_approve boolean, p_reason text default null)
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

revoke execute on function public.approve_run(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.approve_run(uuid, boolean, text) to authenticated, service_role;
