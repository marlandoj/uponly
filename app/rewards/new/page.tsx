import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyCircle } from "@/lib/circle";
import { FULFILLMENT_KINDS, FULFILLMENT_LABELS } from "@/lib/fulfillment";
import { QUESTS } from "@/lib/quests";
import { createReward } from "../actions";

export default async function NewRewardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!(await getMyCircle())) redirect("/circle");
  const { error } = await searchParams;

  return (
    <>
      <h1>New food reward</h1>
      {error && <p className="error">{error}</p>}
      <form action={createReward} className="card">
        <label>
          Reward
          <input name="name" maxLength={60} placeholder="Friday pizza night" required />
        </label>
        <label>
          Description
          <textarea name="description" maxLength={280} placeholder="Any large pizza, your pick" />
        </label>
        <label>
          Value in dollars (optional)
          <input name="value" inputMode="decimal" pattern="\$?\d{1,4}(\.\d{1,2})?" placeholder="15.00" />
        </label>
        <label>
          How it&apos;s fulfilled
          <select name="fulfillment" defaultValue="mock-doordash" required>
            {FULFILLMENT_KINDS.map((k) => (
              <option key={k} value={k}>{FULFILLMENT_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <label>
          Earned by quest
          <select name="quest" defaultValue="">
            <option value="">Any quest</option>
            {QUESTS.map((q) => (
              <option key={q.key} value={q.key}>{q.emoji} {q.title}</option>
            ))}
          </select>
        </label>
        <p className="muted">Mock providers look real but never charge or order anything.</p>
        <button type="submit">Create reward</button>
      </form>
      <Link href="/rewards" className="muted center">Back to rewards</Link>
    </>
  );
}
