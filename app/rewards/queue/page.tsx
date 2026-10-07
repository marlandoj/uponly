import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyCircle } from "@/lib/circle";
import { FULFILLMENT_LABELS } from "@/lib/fulfillment";
import { getFulfillmentQueue } from "@/lib/rewardsData";
import { resolveSprite } from "@/lib/sprite";
import Sprite from "../../components/Sprite";
import { markFulfilled } from "../actions";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const circle = await getMyCircle();
  if (!circle) redirect("/circle");
  const { error } = await searchParams;
  const queue = await getFulfillmentQueue(circle.id);

  return (
    <>
      <h1>Fulfillment queue</h1>
      {error && <p className="error">{error}</p>}
      <section className="card">
        {queue.length === 0 ? (
          <p className="muted">Nothing earned yet. Rewards show up here when a quest is finished.</p>
        ) : (
          <ul className="queue">
            {queue.map((e) => {
              const sprite = resolveSprite("reward", e.reward?.name);
              return (
                <li key={e.id}>
                  <strong className={sprite ? "with-sprite" : undefined}>
                    {sprite && <Sprite src={sprite} size={40} />}
                    <span>
                      {e.reward?.name} <span className={`pill ${e.status}`}>{e.status}</span>
                    </span>
                  </strong>
                  <span className="muted">
                    {e.kid?.display_name ?? "A circle-mate"} · earned {when(e.earned_at)}
                  </span>
                  {e.reward && <span className="muted">{FULFILLMENT_LABELS[e.reward.fulfillment]}</span>}
                  {e.fulfillment_ref && <span className="muted">Ref: {e.fulfillment_ref}</span>}
                  {e.status === "earned" && (
                    <form action={markFulfilled}>
                      <input type="hidden" name="id" value={e.id} />
                      <button type="submit">Mark fulfilled</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <Link href="/rewards" className="muted center">Back to rewards</Link>
    </>
  );
}
