import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyCircle, getMyHouseholdRole } from "@/lib/circle";
import { FULFILLMENT_LABELS } from "@/lib/fulfillment";
import { resolveLootSprite } from "@/lib/lootSprites";
import { formatCents, questLabel, type Reward } from "@/lib/rewards";
import { getCircleRewards } from "@/lib/rewardsData";

export default async function RewardsPage() {
  const circle = await getMyCircle();
  if (!circle) redirect("/circle");
  const [rewards, role] = await Promise.all([getCircleRewards(circle.id), getMyHouseholdRole()]);

  return (
    <>
      <h1>Rewards &amp; loot</h1>
      <p className="muted">Finish the quest, the reward drops instantly.</p>
      {role === "gamemaster" && <Link href="/rewards/new" className="button">Add a reward</Link>}
      <Link href="/rewards/shop" className="button secondary">Browse Fortnite shop</Link>
      <Link href="/rewards/queue" className="button secondary">Fulfillment queue</Link>

      <section className="card">
        <h2>{circle.name}&apos;s rewards</h2>
        {rewards.length === 0 ? (
          <p className="muted">No rewards yet. Add one and attach it to a quest.</p>
        ) : (
          <ul className="queue">
            {rewards.map((r) =>
              r.kind === "game_credit" ? (
                <LootCard key={r.id} reward={r} />
              ) : (
                <li key={r.id}>
                  <strong>
                    {r.name}
                    {r.value_cents != null && <span className="muted"> · {formatCents(r.value_cents)}</span>}
                  </strong>
                  {r.description && <span className="muted">{r.description}</span>}
                  <span className="muted">
                    {questLabel(r.quest_key)} · {FULFILLMENT_LABELS[r.fulfillment]}
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
      <p className="muted center">
        Demo mode: Tremendous and DoorDash fulfillment is mocked — no charges, no real orders. Game loot is a gift
        card; nothing is bought in-game.
      </p>
      <Link href="/" className="muted center">Back to squad</Link>
    </>
  );
}

function LootCard({ reward: r }: { reward: Reward }) {
  const sprite = resolveLootSprite(r);
  return (
    <li className="loot-card">
      {r.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote shop art, display only
        <img src={r.image_url} alt="" width={128} height={128} loading="lazy" className="shop-art" />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- static pixel sprite */}
          {sprite && <img src={sprite} alt="" width={56} height={56} className="pixel" />}
        </>
      )}
      <div>
        <span className="loot-badge">GAME LOOT</span>
        <strong>
          🎮 {r.name}
          {r.value_cents != null && <span className="muted"> · {formatCents(r.value_cents)}</span>}
        </strong>
        {r.description && <span className="muted">{r.description}</span>}
        <span className="muted">
          {r.game} · {questLabel(r.quest_key)} · {FULFILLMENT_LABELS[r.fulfillment]}
        </span>
      </div>
    </li>
  );
}
