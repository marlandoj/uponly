import Link from "next/link";
import { isVideoPath } from "@/lib/evidence";
import type { QuestRun } from "@/lib/questRuns";
import type { QueuedRun } from "@/lib/reviewData";

type Player = { display_name: string; gamer_tag: string | null };

const timeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Squad home: finishes waiting on the viewer's review. Rendered only when there's at least one. */
export default function ReviewQueue({
  queue,
  players,
  isGameMaster,
}: {
  queue: QueuedRun[];
  players: Map<string, Player>;
  isGameMaster: boolean;
}) {
  return (
    <section className="card review-queue">
      <h2>Waiting for review</h2>
      {!isGameMaster && <p className="muted">⏳ Waiting on the GameMaster</p>}
      <ul className="queue-list">
        {queue.map(({ run, evidence }) => {
          const player = players.get(run.user_id);
          return (
            <li key={run.id}>
              <Link href={`/quest/${run.id}`} className="queue-row">
                <span className="queue-thumbs">
                  <Thumb label="Before" src={evidence.before} path={run.before_path} />
                  <Thumb label="After" src={evidence.after} path={run.after_path} />
                </span>
                <span className="queue-info">
                  <strong className="queue-title">{run.title}</strong>
                  <span className="queue-player">
                    {player?.display_name ?? "A squadmate"}
                    {player?.gamer_tag && <span className="queue-tag"> · 🎮 {player.gamer_tag}</span>}
                  </span>
                  <span className="queue-meta">
                    <VerdictBadge run={run} />
                    {run.attempt_no > 1 && <span className="attempt-chip">Attempt {run.attempt_no}</span>}
                  </span>
                  {run.completed_at && (
                    <time className="muted" dateTime={run.completed_at}>
                      {timeFmt.format(new Date(run.completed_at))}
                    </time>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Small, non-interactive tile: the whole row is the link. */
function Thumb({ label, src, path }: { label: string; src: string | null; path: string | null }) {
  if (!src) return <span className="queue-thumb missing" aria-label={`${label} unavailable`}>?</span>;
  if (isVideoPath(path)) {
    return <video className="queue-thumb" src={src} muted playsInline preload="metadata" aria-label={`${label} clip`} />;
  }
  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
  return <img className="queue-thumb" src={src} alt={`${label} photo`} />;
}

function VerdictBadge({ run }: { run: Pick<QuestRun, "verification" | "before_path" | "after_path"> }) {
  const v = run.verification;
  const [cls, text] =
    v === "pass"
      ? ["pass", "✅ AI: looks done"]
      : v === "fail"
        ? ["warn", "🤔 AI: not spotted"]
        : v === "unclear"
          ? ["warn", "📸 AI: unsure"]
          : v === null && (isVideoPath(run.after_path) || isVideoPath(run.before_path))
            ? ["photo", "🎥 Clip"]
            : ["photo", "📸 Photo-only"];
  return <span className={`verdict-badge ${cls}`}>{text}</span>;
}
