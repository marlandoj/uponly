import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuestRun } from "@/lib/questRuns";
import { abandonQuest } from "../actions";
import QuestRunner from "./QuestRunner";

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

  return (
    <>
      <h1>{run.title}</h1>
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
        <section className="card">
          <h2>Quest complete 🎉</h2>
          <p>Nice work. Your before and after photos are saved privately.</p>
          <Link href="/quest" className="button">Start another quest</Link>
        </section>
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
