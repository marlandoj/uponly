import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyCircle, getMyHouseholdRole } from "@/lib/circle";
import { FULFILLMENT_LABELS } from "@/lib/fulfillment";
import { getFulfillmentQueue } from "@/lib/rewardsData";
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
  // mark_earning_fulfilled is GameMasters-only for manual hand-overs.
  const isGameMaster = (await getMyHouseholdRole()) === "gamemaster";

  return (
    <>
      <h1>Fulfillment queue</h1>
      {error && <p className="error">{error}</p>}
      {!isGameMaster && <p className="notice">🛡️ GameMasters only — the GameMaster marks loot as handed over.</p>}
      <section className="card">
        {queue.length === 0 ? (
          <p className="muted">Nothing earned yet. Rewards show up here when a quest is finished.</p>
        ) : (
          <ul className="queue">
            {queue.map((e) => (
              <li key={e.id}>
                <strong>
                  {e.reward?.kind === "game_credit" && "🎮 "}
                  {e.reward?.name} <span className={`pill ${e.status}`}>{e.status}</span>
                </strong>
                <span className="muted">
                  {e.gamer?.display_name ?? "A squadmate"} · earned {when(e.earned_at)}
                </span>
                {e.reward && (
                  <span className="muted">
                    {e.reward.game && `${e.reward.game} loot · `}
                    {FULFILLMENT_LABELS[e.reward.fulfillment]}
                  </span>
                )}
                {e.fulfillment_ref && <span className="muted">Ref: {e.fulfillment_ref}</span>}
                {e.status === "earned" && isGameMaster && (
                  <form action={markFulfilled}>
                    <input type="hidden" name="id" value={e.id} />
                    <button type="submit">Mark fulfilled</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Link href="/rewards" className="muted center">Back to rewards</Link>
    </>
  );
}
