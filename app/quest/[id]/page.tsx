import Link from "next/link";
import { notFound } from "next/navigation";
import { isVideoPath } from "@/lib/evidence";
import { getMyHouseholdRole } from "@/lib/circle";
import { choreSizeMeta, isChoreSize } from "@/lib/choreTiers";
import { isPhotoOnlyPath } from "@/lib/progressCheck";
import { getQuestRun, type QuestRun } from "@/lib/questRuns";
import { formatCents } from "@/lib/rewards";
import { getRunRewards } from "@/lib/rewardsData";
import { getRunComments, signRunEvidence } from "@/lib/reviewData";
import { createClient } from "@/lib/supabase/server";
import { abandonQuest, deleteQuestPhotos, submitReview } from "../actions";
import Celebration from "./Celebration";
import CelebrationFx from "./CelebrationFx";
import Comments from "./Comments";
import Evidence from "./Evidence";
import QuestRunner from "./QuestRunner";
import RejectForm from "./RejectForm";
import RewardDrop from "./RewardDrop";
import BackButton from "@/app/BackButton";

// The full-screen reward drop plays on the first view after earning.
const FRESH_DROP_MS = 10 * 60 * 1000;

// Signed evidence URLs expire after 5 minutes; never serve this page from cache.
export const dynamic = "force-dynamic";

export default async function QuestRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; approved?: string; redo?: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // RLS returns the caller's own runs and their squadmates' runs only.
  const run = user ? await getQuestRun(id) : null;
  if (!user || !run) notFound();
  const query = await searchParams;
  const comments = await getRunComments(run.id);

  return (
    <>
      <BackButton />      {run.user_id === user.id ? <OwnerView run={run} error={query.error} /> : <GiverView run={run} query={query} />}
      {run.status !== "draft" && <Comments runId={run.id} viewerId={user.id} comments={comments} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// The player's own run
// ---------------------------------------------------------------------------
async function OwnerView({ run, error }: { run: QuestRun; error?: string }) {
  const open = run.status === "draft" || run.status === "active";
  const approved = run.status === "completed" && run.approval_status === "approved";
  const earned = approved ? await getRunRewards(run.id) : null;
  const freshDrop =
    !!earned?.latestEarnedAt && Date.now() - Date.parse(earned.latestEarnedAt) < FRESH_DROP_MS;
  const size = choreSizeMeta(isChoreSize(run.chore_size) ? run.chore_size : "standard");

  return (
    <>
      <h1>{run.title}</h1>
      <p>
        <span className="loot-badge">
          {size.emoji} {size.label} · ~{formatCents(size.suggestedCents)}
        </span>
      </p>
      <p className="muted">
        Finish condition: <strong>{run.finish_condition}</strong>
      </p>
      <ModeChip run={run} />
      {error && <p className="error">{error}</p>}

      {open ? (
        <QuestRunner
          runId={run.id}
          status={run.status as "draft" | "active"}
          startedAt={run.started_at}
          serverNow={Date.now()}
          redo={run.status === "active" && run.approval_status === "rejected"}
          rejectionReason={run.rejection_reason}
        />
      ) : run.status === "completed" && !approved ? (
        <section className="card waiting">
          <p className="waiting-icon" aria-hidden="true">⏳</p>
          <h2>Waiting for review</h2>
          <p>{waitingReason(run)}</p>
          <ProgressCheck run={run} />
          <p className="muted">Loot drops the moment a squadmate approves. Check back soon.</p>
        </section>
      ) : approved ? (
        <>
          <CelebrationFx runId={run.id} />
          {earned && <RewardDrop rewards={earned.rewards} fresh={freshDrop} />}
          <section className="card">
            <h2>Quest complete 🎉</h2>
            <p>
              Nice work. Your before and after evidence stays private to your squad — squadmates
              see it on this page or through your celebration code.
            </p>
            <ProgressCheck run={run} />
          </section>
          <Celebration run={run} />
          <form action={deleteQuestPhotos}>
            <input type="hidden" name="id" value={run.id} />
            <button type="submit" className="secondary">
              Delete my evidence
            </button>
          </form>
          <p className="muted">
            Evidence stays private to your squad and can be deleted anytime. Ratings already given stay.
          </p>
          <Link href="/quest" className="button">Start another quest</Link>
        </>
      ) : (
        <section className="card">
          <p>This quest was set aside. No harm done — levels only go up.</p>
          <Link href="/quest" className="button">Pick a quest</Link>
        </section>
      )}

      {open && (
        <form action={abandonQuest}>
          <input type="hidden" name="id" value={run.id} />
          <button type="submit" className="secondary">Set this quest aside</button>
        </form>
      )}
    </>
  );
}

function waitingReason(run: QuestRun): string {
  if (run.approval_mode === "giver_approves") return "You picked “I approve each finish” — a squadmate reviews your before and after.";
  if (isVideoPath(run.after_path) || isVideoPath(run.before_path)) return "Clips always get a human look — a squadmate will review it.";
  return "The AI couldn't confirm the finish, so a squadmate will make the call.";
}

// ---------------------------------------------------------------------------
// A squadmate's run: review it (giver), or follow along
// ---------------------------------------------------------------------------
async function GiverView({ run, query }: { run: QuestRun; query: { error?: string; approved?: string; redo?: string } }) {
  const supabase = await createClient();
  const { data: player } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", run.user_id)
    .maybeSingle<{ display_name: string }>();
  const name = player?.display_name ?? "A squadmate";
  const completed = run.status === "completed";
  const pending = completed && run.approval_status === "pending";
  const approved = completed && run.approval_status === "approved";
  // getQuestRun read this run through RLS — that's the circle membership check.
  const evidence = completed ? await signRunEvidence(run) : null;
  const earned = approved ? await getRunRewards(run.id) : null;
  // Only GameMasters review; approve_run enforces it, this just hides the buttons.
  const isGameMaster = pending && (await getMyHouseholdRole()) === "gamemaster";

  return (
    <>
      <h1>{run.title}</h1>
      <p className="muted">
        <strong>{name}</strong> · finish condition: <strong>{run.finish_condition}</strong>
      </p>
      <ModeChip run={run} />
      {query.error && <p className="error">{query.error}</p>}

      {completed && evidence ? (
        <section className={`card review ${pending ? "pending" : ""}`}>
          <h2>{pending ? "Review the finish" : "Before & after"}</h2>
          {(pending || run.attempt_no > 1) && <p className="attempt-chip">Attempt {run.attempt_no}</p>}
          {pending && run.attempt_no > 1 && run.rejection_reason && (
            <p className="last-reason">
              <span className="muted">Last time you asked:</span> {run.rejection_reason}
            </p>
          )}
          <div className="photos">
            <Evidence label="Before" src={evidence.before} path={run.before_path} />
            <Evidence label="After" src={evidence.after} path={run.after_path} />
          </div>
          <ProgressCheck run={run} giver />
          {pending && !isGameMaster && <p className="notice">⏳ Waiting on the GameMaster to review this one.</p>}
          {pending && isGameMaster && (
            <div className="review-actions">
              <form action={submitReview}>
                <input type="hidden" name="id" value={run.id} />
                <button type="submit" name="decision" value="approve" className="approve">
                  ✅ Approve
                </button>
              </form>
              <RejectForm runId={run.id} />
            </div>
          )}
          {approved && <p className="notice">✅ Approved — loot dropped for {name}.</p>}
        </section>
      ) : run.status === "active" && run.approval_status === "rejected" ? (
        <section className="card">
          <h2>🔁 Redo requested</h2>
          <p>{query.redo ? "Sent back. " : ""}{name} will take another after photo or clip. You&apos;ll review it here.</p>
          {run.rejection_reason && (
            <p className="last-reason">
              <span className="muted">What to fix:</span> {run.rejection_reason}
            </p>
          )}
        </section>
      ) : run.status === "abandoned" ? (
        <section className="card">
          <p>{name} set this quest aside.</p>
        </section>
      ) : (
        <section className="card">
          <h2>In progress ⏱️</h2>
          <p>{name} is on it. Their before and after show up here when they finish.</p>
        </section>
      )}

      {earned && <RewardDrop rewards={earned.rewards} fresh={query.approved === "drop"} />}
    </>
  );
}

function ModeChip({ run }: { run: QuestRun }) {
  return (
    <p className={`mode-chip ${run.approval_mode}`}>
      {run.approval_mode === "giver_approves" ? "👀 Giver approves" : "⚡ AI instant drop"}
    </p>
  );
}

// Positive framing for every outcome: the check never undoes a completion.
function ProgressCheck({ run, giver = false }: { run: QuestRun; giver?: boolean }) {
  const v = run.verification;
  const clip = v === null && (isVideoPath(run.after_path) || isVideoPath(run.before_path));
  const title =
    v === "pass"
      ? "✅ AI check: looks done!"
      : v === "fail"
        ? "📸 AI check couldn't spot the finish — still counts"
        : v === "unclear"
          ? "📸 AI check wasn't sure — photo-only"
          : clip
            ? "🎥 Clip — no AI check, human eyes only"
            : "📸 Photo-only";
  const detail =
    run.verification_reason ??
    (isPhotoOnlyPath(v) ? (giver ? "You're the judge — check the before and after." : "Your squadmate will judge from the photos.") : null);
  return (
    <div className={`verdict ${v === "pass" ? "pass" : "photo"}`}>
      <strong>{title}</strong>
      {detail && <p className="muted">{detail}</p>}
    </div>
  );
}
