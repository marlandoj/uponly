-- UpOnly — 0002_quests: quest runs (pick quest + finish condition, before photo,
-- 4-minute minimum timer, after photo).
--
-- Same Data API policy as 0001: revoke to zero, then grant only what the RLS
-- policies allow. Clients never write quest_runs directly — every state change
-- goes through a SECURITY DEFINER RPC so timestamps are server-set and the
-- 4-minute minimum cannot be skipped.
--
-- Lifecycle:  draft --(before photo)--> active --(after photo, >= 4 min)--> completed
--             draft | active --(abandon)--> abandoned
-- The timer starts when the before photo is recorded (started_at = now()).

create table public.quest_runs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  circle_id        uuid not null references public.circles (id) on delete cascade,
  -- quest_key / title / finish_condition come from the catalog in lib/quests.ts;
  -- title + condition are copied so later catalog edits don't rewrite history.
  quest_key        text not null check (quest_key ~ '^[a-z0-9-]{1,40}$'),
  title            text not null check (char_length(title) between 1 and 80),
  finish_condition text not null check (char_length(finish_condition) between 1 and 120),
  status           text not null default 'draft'
                     check (status in ('draft', 'active', 'completed', 'abandoned')),
  -- Storage keys in the private `evidence` bucket: "<user_id>/<run_id>/{before,after}.jpg".
  before_path      text,
  after_path       text,
  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  completed_at     timestamptz,
  constraint quest_runs_active_has_before
    check (status not in ('active', 'completed') or (before_path is not null and started_at is not null)),
  constraint quest_runs_completed_has_after
    check (status <> 'completed' or (after_path is not null and completed_at is not null)),
  constraint quest_runs_min_duration
    check (completed_at is null or completed_at >= started_at + interval '4 minutes')
);

-- At most one in-progress quest per player.
create unique index quest_runs_one_open_per_user
  on public.quest_runs (user_id) where status in ('draft', 'active');

create index quest_runs_user_created on public.quest_runs (user_id, created_at desc);

alter table public.quest_runs enable row level security;

-- Owner-only for now; circle-mate visibility (rating, leaderboard) is added by
-- the migration that introduces sharing.
create policy "quest_runs: owner read"
  on public.quest_runs for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.quest_runs from anon, authenticated, service_role;
grant select on table public.quest_runs to authenticated;
grant select, insert, update, delete on table public.quest_runs to service_role;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create function public.start_quest(p_quest_key text, p_title text, p_finish_condition text)
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

  select circle_id into v_circle from public.circle_members where user_id = v_uid;
  if v_circle is null then
    raise exception 'join a circle first' using errcode = 'P0002';
  end if;

  insert into public.quest_runs (user_id, circle_id, quest_key, title, finish_condition)
  values (v_uid, v_circle, p_quest_key, btrim(p_title), btrim(p_finish_condition))
  returning * into v_run;

  return v_run;
exception
  when unique_violation then
    raise exception 'you already have a quest in progress' using errcode = '23505';
end;
$$;

-- Called by the photo route handler after it has uploaded the object. The path
-- is derived here (not passed in) and must exist in storage.
create function public.record_before_photo(p_run_id uuid)
returns public.quest_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_path text := v_uid::text || '/' || p_run_id::text || '/before.jpg';
  v_run  public.quest_runs;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'evidence' and name = v_path) then
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

create function public.complete_quest(p_run_id uuid)
returns public.quest_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_path text := v_uid::text || '/' || p_run_id::text || '/after.jpg';
  v_run  public.quest_runs;
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

  update public.quest_runs
     set status = 'completed', after_path = v_path, completed_at = now()
   where id = p_run_id
  returning * into v_run;

  return v_run;
end;
$$;

create function public.abandon_quest(p_run_id uuid)
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
     set status = 'abandoned'
   where id = p_run_id and user_id = v_uid and status in ('draft', 'active')
  returning * into v_run;

  if v_run.id is null then
    raise exception 'quest is not in progress' using errcode = '55000';
  end if;
  return v_run;
end;
$$;

revoke execute on function
  public.start_quest(text, text, text),
  public.record_before_photo(uuid),
  public.complete_quest(uuid),
  public.abandon_quest(uuid)
  from public, anon, authenticated;

grant execute on function
  public.start_quest(text, text, text),
  public.record_before_photo(uuid),
  public.complete_quest(uuid),
  public.abandon_quest(uuid)
  to authenticated, service_role;
