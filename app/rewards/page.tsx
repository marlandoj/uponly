import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyCircle } from "@/lib/circle";
import { FULFILLMENT_LABELS } from "@/lib/fulfillment";
import { formatCents, questLabel } from "@/lib/rewards";
import { getCircleRewards } from "@/lib/rewardsData";
import { resolveSprite } from "@/lib/sprite";
import Sprite from "../components/Sprite";

export default async function RewardsPage() {
  const circle = await getMyCircle();
  if (!circle) redirect("/circle");
  const rewards = await getCircleRewards(circle.id);

  return (
    <>
      <h1>Food rewards</h1>
      <p className="muted">Finish the quest, the reward drops instantly.</p>
      <Link href="/rewards/new" className="button">Add a food reward</Link>
      <Link href="/rewards/queue" className="button secondary">Fulfillment queue</Link>

      <section className="card">
        <h2>{circle.name}&apos;s rewards</h2>
        {rewards.length === 0 ? (
          <p className="muted">No rewards yet. Add one and attach it to a quest.</p>
        ) : (
          <ul className="queue">
            {rewards.map((r) => {
              const sprite = resolveSprite("reward", r.name);
              const details = (
                <>
                  <strong>
                    {r.name}
                    {r.value_cents != null && <span className="muted"> · {formatCents(r.value_cents)}</span>}
                  </strong>
                  {r.description && <span className="muted">{r.description}</span>}
                  <span className="muted">
                    {questLabel(r.quest_key)} · {FULFILLMENT_LABELS[r.fulfillment]}
                  </span>
                </>
              );
              return sprite ? (
                <li key={r.id} className="with-sprite">
                  <Sprite src={sprite} size={56} />
                  <div>{details}</div>
                </li>
              ) : (
                <li key={r.id}>{details}</li>
              );
            })}
          </ul>
        )}
      </section>
      <p className="muted center">Demo mode: Tremendous and DoorDash fulfillment is mocked — no charges, no real orders.</p>
      <Link href="/" className="muted center">Back to circle</Link>
    </>
  );
}
