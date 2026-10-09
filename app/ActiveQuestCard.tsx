import Link from "next/link";
import type { QuestRun } from "@/lib/questRuns";

type OpenRun = Pick<QuestRun, "id" | "title" | "status">;

/** What the player needs to do next on their open run. */
export function activeQuestLabel(status: OpenRun["status"]): string {
  return status === "draft" ? "Snap your before photo" : "Quest in progress — timer running";
}

/** Home-screen card pointing back to the caller's draft/active quest. */
export default function ActiveQuestCard({ run }: { run: OpenRun }) {
  return (
    <section className="card active-quest">
      <h2>Your active quest</h2>
      <strong>{run.title}</strong>
      <p className="notice">{activeQuestLabel(run.status)}</p>
      <Link href={`/quest/${run.id}`} className="button">Resume quest</Link>
    </section>
  );
}
