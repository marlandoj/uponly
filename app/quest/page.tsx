import { redirect } from "next/navigation";
import { CHORE_SIZES } from "@/lib/choreTiers";
import { getMyCircle } from "@/lib/circle";
import { getOpenQuestRun } from "@/lib/questRuns";
import { MIN_QUEST_SECONDS, QUESTS } from "@/lib/quests";
import { formatCents } from "@/lib/rewards";
import { startQuest } from "./actions";

export default async function QuestPickerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!(await getMyCircle())) redirect("/circle");
  const open = await getOpenQuestRun();
  if (open) redirect(`/quest/${open.id}`);
  const { error } = await searchParams;

  return (
    <>
      <h1>Pick a quest</h1>
      <p className="muted">
        Choose a chore and how you&apos;ll know it&apos;s done. Snap a before photo, give it at
        least {MIN_QUEST_SECONDS / 60} minutes, then snap the after.
      </p>
      {error && <p className="error">{error}</p>}

      <form action={startQuest} className="quest-list">
        <fieldset className="card">
          <legend>Chore size</legend>
          {CHORE_SIZES.map((s) => (
            <label key={s.id} className="choice">
              <input type="radio" name="size" value={s.id} defaultChecked={s.id === "standard"} />
              {s.emoji} {s.label} · ~{formatCents(s.suggestedCents)}
            </label>
          ))}
        </fieldset>
        {QUESTS.map((q) => (
          <fieldset key={q.key} className="card">
            <legend>
              <span aria-hidden>{q.emoji}</span> {q.title}
            </legend>
            {q.finishConditions.map((c) => (
              <label key={c} className="choice">
                <input type="radio" name="pick" value={`${q.key}::${c}`} required />
                {c}
              </label>
            ))}
          </fieldset>
        ))}
        <fieldset className="card approval-mode">
          <legend>How it&apos;s checked</legend>
          <label className="choice">
            <input type="radio" name="approvalMode" value="ai_instant" defaultChecked />
            <span>
              <strong>⚡ AI instant drop</strong>
              <span className="muted"> — an AI pass on your photos drops loot right away; anything else goes to your squad.</span>
            </span>
          </label>
          <label className="choice">
            <input type="radio" name="approvalMode" value="giver_approves" />
            <span>
              <strong>👀 I approve each finish</strong>
              <span className="muted"> — a squadmate reviews the before/after and approves or asks for a redo.</span>
            </span>
          </label>
        </fieldset>
        <button type="submit" className="sticky">Start quest</button>
      </form>
    </>
  );
}
