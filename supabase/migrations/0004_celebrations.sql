-- UpOnly — 0004_celebrations: share a completed quest for celebration (QR /
-- link / 6-char code), circle-mates rate it 3/4/5, level ticks up, completion
-- XP chips away at the Boss, and the first celebration earns the First Fold badge.
--
-- Mirrors lib/rating.ts (the TS ledger is the reference; this is the enforcing
-- copy):
--   * completion: first 3 per player per UTC day are credited (+10 XP); later
--     ones are recorded but earn nothing and cannot be rated
--   * rating:     3 = Done (+2 XP), 4 = Great (+4), 5 = Legendary (+6);
--                 S += (rating − 3) × 0.06 × (1.0 if AI pass else 0.8)
--                 level = 3.50 + 1.50 × (1 − e^−S)   — never decreases
--   * caps:       no self-rating; one rating per rater per quest; at most 2
--                 counted per quest; a rater's first 5 counted per UTC day
--   * anti-abuse: raters must have joined the circle >= 24h before the quest started
-- Ratings over a cap are still recorded (counted = false) so the rater gets a
-- thank-you, but they change nothing.
--
-- Photo sharing: storage stays owner-only. get_celebration() is the membership
-- check; only after it returns a row does the server sign 5-minute URLs for
-- that run's two photos with the service-role client.
--
-- Same Data API policy as 0001: revoke to zero, grant only what RLS allows.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
-- S from the level formula; level is derived from it on every counted rating.
alter table public.profiles
  add column score numeric(12, 6) not null default 0 check (score >= 0);

alter table public.quest_runs
  -- set by complete_quest: whether this completion counts toward the daily cap
  add column credited            boolean,
  add column completion_xp       integer not null default 0 check (completion_xp in (0, 10)),
  -- the player's total XP right after this completion (for the Boss bar replay)
  add column xp_after_completion integer,
  -- celebration share code, set by share_quest; same alphabet as circle join codes
  add column rating_code         text unique check (rating_code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  add column shared_at           timestamptz;

-- Completions from before this migration: rateable, but no retroactive XP.
update public.quest_runs set credited = true where status = 'completed';

alter table public.quest_runs
  add constraint quest_runs_credited_when_completed
    check (status <> 'completed' or credited is not null),
  add constraint quest_runs_shared_when_completed
    check ((rating_code is null) = (shared_at is null) and (rating_code is null or status = 'completed'));

create index quest_runs_user_credited_day
  on public.quest_runs (user_id, completed_at) where credited;

-- ---------------------------------------------------------------------------
-- quest_ratings
-- ---------------------------------------------------------------------------
create table public.quest_ratings (
  id                 uuid primary key default gen_random_uuid(),
  run_id             uuid not null references public.quest_runs (id) on delete cascade,
  rater_id           uuid not null references public.profiles (id) on delete cascade,
  ratee_id           uuid not null references public.profiles (id) on delete cascade,
  rating             smallint not null check (rating between 3 and 5),
  counted            boolean not null,
  not_counted_reason text check (not_counted_reason in
                       ('completion_not_credited', 'completion_rating_cap', 'rater_daily_cap')),
  xp_awarded         integer not null default 0 check (xp_awarded in (0, 2, 4, 6)),
  score_delta        numeric(12, 6) not null default 0 check (score_delta >= 0),
  -- ratee's standing around this rating, for the level-tick animation
  level_before       numeric(4, 2) not null,
  level_after        numeric(4, 2) not null,
  xp_after           integer not null,
  first_fold         boolean not null default false,
  created_at         timestamptz not null default now(),
  unique (run_id, rater_id),
  constraint quest_ratings_no_self check (rater_id <> ratee_id),
  constraint quest_ratings_up_only check (level_after >= level_before),
  constraint quest_ratings_counted_reason check (counted = (not_counted_reason is null))
);

create index quest_ratings_rater_day on public.quest_ratings (rater_id, created_at) where counted;
create index quest_ratings_ratee on public.quest_ratings (ratee_id, created_at desc);

alter table public.quest_ratings enable row level security;

create policy "quest_ratings: rater and ratee read"
  on public.quest_ratings for select to authenticated
  using (rater_id = (select auth.uid()) or ratee_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- badges  (DB record; the soulbound mint is a later step)
-- ---------------------------------------------------------------------------
create table public.badges (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  badge      text not null check (badge in ('first_fold')),
  run_id     uuid references public.quest_runs (id) on delete set null,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge)
);

alter table public.badges enable row level security;

create policy "badges: read self and circle-mates"
  on public.badges for select to authenticated
  using (user_id = (select auth.uid()) or public.shares_circle_with(user_id));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on table public.quest_ratings, public.badges from anon, authenticated, service_role;
grant select on table public.quest_ratings, public.badges to authenticated;
grant select, insert, update, delete on table public.quest_ratings, public.badges to service_role;
-- profiles.score and the new quest_runs columns ride on the existing
-- table-level SELECT; clients still can't write them (column-level UPDATE on
-- profiles is display_name only, and quest_runs has no client UPDATE).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.level_from_score(p_score numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round(3.50 + 1.50 * (1 - exp(-greatest(p_score, 0))), 2);
$$;

-- ---------------------------------------------------------------------------
-- complete_quest: unchanged checks, plus daily credit + completion XP
-- ---------------------------------------------------------------------------
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

  update public.profiles
     set xp = xp + case when v_credited then 10 else 0 end,
         quests_completed = quests_completed + 1
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
-- share_quest: owner turns a credited completion into a celebration code
-- ---------------------------------------------------------------------------
create function public.share_quest(p_run_id uuid)
returns text
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
  if v_run.id is null or v_run.status <> 'completed' then
    raise exception 'only completed quests can be celebrated' using errcode = '55000';
  end if;
  if v_run.rating_code is not null then
    return v_run.rating_code;  -- idempotent
  end if;
  if not v_run.credited then
    raise exception 'daily celebration limit reached — this one is just for you' using errcode = '55000';
  end if;

  loop
    begin
      update public.quest_runs
         set rating_code = public.gen_join_code(), shared_at = now()
       where id = p_run_id
      returning * into v_run;
      exit;
    exception when unique_violation then
      -- code collision; retry
    end;
  end loop;

  return v_run.rating_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_celebration: membership check + everything the rating page shows.
-- Returns no row unless the caller is in the quest's circle.
-- eligibility: 'self' | 'rated' | 'new_member' | 'ok'
-- ---------------------------------------------------------------------------
create function public.get_celebration(p_code text)
returns table (
  run_id              uuid,
  title               text,
  finish_condition    text,
  verification        text,
  verification_reason text,
  completed_at        timestamptz,
  player_id           uuid,
  player_name         text,
  player_level        numeric,
  before_path         text,
  after_path          text,
  eligibility         text,
  -- for 'new_member': quests started after this time are rateable
  can_rate_from       timestamptz,
  my_rating           smallint,
  my_counted          boolean,
  my_not_counted      text,
  my_xp_awarded       integer,
  my_level_before     numeric,
  my_level_after      numeric,
  my_xp_after         integer,
  my_first_fold       boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.title, r.finish_condition, r.verification, r.verification_reason,
         r.completed_at, p.id, p.display_name, p.level, r.before_path, r.after_path,
         case
           when r.user_id = me.user_id then 'self'
           when q.id is not null then 'rated'
           when me.joined_at > r.started_at - interval '24 hours' then 'new_member'
           else 'ok'
         end,
         me.joined_at + interval '24 hours',
         q.rating, q.counted, q.not_counted_reason, q.xp_awarded,
         q.level_before, q.level_after, q.xp_after, q.first_fold
    from public.quest_runs r
    join public.circle_members me
      on me.circle_id = r.circle_id and me.user_id = (select auth.uid())
    join public.profiles p on p.id = r.user_id
    left join public.quest_ratings q
      on q.run_id = r.id and q.rater_id = me.user_id
   where r.rating_code = upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'))
     and r.status = 'completed';
$$;

-- ---------------------------------------------------------------------------
-- rate_quest: the only way a rating is written.
-- ---------------------------------------------------------------------------
create function public.rate_quest(p_code text, p_rating integer)
returns public.quest_ratings
language plpgsql
security definer
set search_path = ''
as $$
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
    raise exception 'no celebration with that code in your circle' using errcode = 'P0002';
  end if;
  if v_run.user_id = v_uid then
    raise exception 'you can''t rate your own quest' using errcode = '42501';
  end if;
  if v_joined > v_run.started_at - interval '24 hours' then
    raise exception 'you can rate quests that start 24 hours after you joined the circle'
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
$$;

revoke execute on function
  public.level_from_score(numeric),
  public.share_quest(uuid),
  public.get_celebration(text),
  public.rate_quest(text, integer)
  from public, anon, authenticated;

grant execute on function
  public.share_quest(uuid),
  public.get_celebration(text),
  public.rate_quest(text, integer)
  to authenticated, service_role;

grant execute on function public.level_from_score(numeric) to service_role;
