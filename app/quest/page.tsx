import { redirect } from "next/navigation";
import { getMyCircle } from "@/lib/circle";
import { getOpenQuestRun } from "@/lib/questRuns";
import { MIN_QUEST_SECONDS, QUESTS } from "@/lib/quests";
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
        <button type="submit" className="sticky">Start quest</button>
      </form>
    </>
  );
}
