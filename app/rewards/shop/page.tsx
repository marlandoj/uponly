import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyCircle } from "@/lib/circle";
import { getFortniteShop } from "@/lib/fortniteShop";
import { shopItemToRewardInput } from "@/lib/gameRewards";
import { createReward } from "../actions";
import GameLootTemplates, { RewardFields } from "../GameLootTemplates";

// DISPLAY ONLY. GameMasters browse today's Fortnite shop and turn an item into a
// chore reward; the gamer earns a (mock) gift card worth its V-Bucks. There is
// no buy button and no cart — nothing is ever purchased in-game.

export default async function FortniteShopPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!(await getMyCircle())) redirect("/circle");
  const { error } = await searchParams;
  const shop = await getFortniteShop();

  return (
    <>
      <h1>Fortnite shop</h1>
      <p className="muted">
        Pick something from today&apos;s shop and link it to a chore. Finishing a quest drops a gift card for the
        V-Bucks — we never buy anything in the game.
      </p>
      {error && <p className="error">{error}</p>}

      {shop.ok ? (
        <ul className="loot-grid">
          {shop.items.map((item) => (
            <li key={item.id}>
              <form action={createReward} className="loot-tile">
                <RewardFields from="/rewards/shop" input={shopItemToRewardInput(item)} />
                {/* eslint-disable-next-line @next/next/no-img-element -- remote shop art, display only */}
                <img src={item.image} alt="" width={128} height={128} loading="lazy" className="shop-art" />
                <strong>{item.name}</strong>
                <span className="vbucks">
                  {item.vbucks.toLocaleString("en-US")} V-Bucks
                  {item.regularVbucks > item.vbucks && (
                    <s className="muted"> {item.regularVbucks.toLocaleString("en-US")}</s>
                  )}
                </span>
                <span className="muted">{item.type}</span>
                <button type="submit">Link to chore</button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="notice">Shop unavailable right now ({shop.reason}). Grab a credit pack instead:</p>
          <GameLootTemplates from="/rewards/shop" />
        </>
      )}

      <p className="muted center">Shop data from fortnite-api.com, refreshed hourly. Not affiliated with Epic Games.</p>
      <Link href="/rewards" className="muted center">Back to rewards</Link>
    </>
  );
}
