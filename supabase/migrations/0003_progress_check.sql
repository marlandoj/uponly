-- UpOnly — 0003_progress_check: result of the AI-assisted progress check.
--
-- The check runs server-side right after complete_quest succeeds, so it can
-- never block completion. Only the service role writes these columns (the
-- route handler's admin client); players can read them through the existing
-- owner-read policy but cannot set their own verdict.
--
--   verification  null         check not recorded (no key / no service role) → photo-only
--                 'pass'       AI saw the finish condition met → full rating weight
--                 'unclear'    AI couldn't tell → photo-only path
--                 'fail'       AI saw it not met → still completed, reduced weight
--                 'photo-only' check didn't produce a verdict (timeout, error, off)

alter table public.quest_runs
  add column verification text
    check (verification in ('pass', 'unclear', 'fail', 'photo-only')),
  add column verification_reason text
    check (char_length(verification_reason) <= 200),
  add column verified_at timestamptz,
  add constraint quest_runs_verified_when_completed
    check (verification is null or status = 'completed');

-- Grants are unchanged: authenticated already has table-level SELECT (owner
-- rows only via RLS) and no UPDATE; service_role keeps SELECT/INSERT/UPDATE/DELETE.
