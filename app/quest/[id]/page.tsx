import Link from "next/link";
import { notFound } from "next/navigation";
import { choreSizeMeta, isChoreSize } from "@/lib/choreTiers";
import { isPhotoOnlyPath } from "@/lib/progressCheck";
import { getQuestRun, type QuestRun } from "@/lib/questRuns";
import { formatCents } from "@/lib/rewards";
import { getRunRewards } from "@/lib/rewardsData";
import { abandonQuest, deleteQuestPhotos } from "../actions";
import Celebration from "./Celebration";
import QuestRunner from "./QuestRunner";
import RewardDrop from "./RewardDrop";

// The full-screen reward drop plays on the first view after earning.
const FRESH_DROP_MS = 10 * 60 * 1000;

export default async function QuestRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const run = await getQuestRun(id);
  if (!run) notFound();
  const { error } = await searchParams;
  const open = run.status === "draft" || run.status === "active";
  const earned = run.status === "completed" ? await getRunRewards(run.id) : null;
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
      {error && <p className="error">{error}</p>}

      {open ? (
        <QuestRunner
          runId={run.id}
          status={run.status as "draft" | "active"}
          startedAt={run.started_at}
          serverNow={Date.now()}
        />
      ) : run.status === "completed" ? (
        <>
          {earned && <RewardDrop rewards={earned.rewards} fresh={freshDrop} />}
          <section className="card">
            <h2>Quest complete 🎉</h2>
            <p>
              Nice work. Your before and after photos stay private — circle-mates only see them
              through your celebration code.
            </p>
            <ProgressCheck run={run} />
          </section>
          <Celebration run={run} />
          <form action={deleteQuestPhotos}>
            <input type="hidden" name="id" value={run.id} />
            <button type="submit" className="secondary">
              Delete my evidence photos
            </button>
          </form>
          <p className="muted">
            Photos stay private to your circle and can be deleted anytime. Ratings already given stay.
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
      <Link href="/" className="muted center">Back to circle</Link>
    </>
  );
}

// Positive framing for every outcome: the check never undoes a completion.
function ProgressCheck({ run }: { run: QuestRun }) {
  const v = run.verification;
  const title =
    v === "pass"
      ? "✅ AI check: looks done!"
      : v === "fail"
        ? "📸 AI check couldn't spot the finish — still counts"
        : v === "unclear"
          ? "📸 AI check wasn't sure — photo-only"
          : "📸 Photo-only";
  const detail =
    run.verification_reason ??
    (isPhotoOnlyPath(v) ? "Your circle-mate will judge from the photos." : null);
  return (
    <div className={`verdict ${v === "pass" ? "pass" : "photo"}`}>
      <strong>{title}</strong>
      {detail && <p className="muted">{detail}</p>}
    </div>
  );
}
