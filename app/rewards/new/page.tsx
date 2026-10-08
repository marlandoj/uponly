import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyCircle, getMyHouseholdRole } from "@/lib/circle";
import { FULFILLMENT_KINDS, FULFILLMENT_LABELS } from "@/lib/fulfillment";
import { QUESTS } from "@/lib/quests";
import { parseChoreSize } from "@/lib/choreTiers";
import { GAMES, isGame } from "@/lib/rewards";
import { createReward } from "../actions";
import GameLootTemplates from "../GameLootTemplates";
import LootPicker from "./LootPicker";

export default async function NewRewardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; size?: string; tag?: string; games?: string }>;
}) {
  if (!(await getMyCircle())) redirect("/circle");
  const params = await searchParams;
  const { error } = params;
  const size = parseChoreSize(params.size);
  const games = String(params.games ?? "").split(",").map((s) => s.trim()).filter(isGame);
  const tag = String(params.tag ?? "").trim().slice(0, 32);

  // create_reward is GameMasters-only; gamers get the note instead of forms that would bounce.
  if ((await getMyHouseholdRole()) !== "gamemaster") {
    return (
      <>
        <h1>New reward</h1>
        <p className="notice">🛡️ GameMasters only — ask the GameMaster to add loot for your quests.</p>
        <Link href="/rewards" className="muted center">Back to rewards</Link>
      </>
    );
  }

  return (
    <>
      <h1>New reward</h1>
      {error && <p className="error">{error}</p>}

      <section className="card" id="loot">
        <h2>🎮 Game loot</h2>
        <p className="muted">One tap adds a credit pack any quest can earn. It drops as a gift card — no in-game purchases.</p>
        <Link href="/rewards/shop" className="button secondary">Browse Fortnite shop</Link>
      </section>
      {games.length > 0 && <LootPicker games={games} size={size} tag={tag} />}
      <GameLootTemplates from="/rewards/new" />

      <form action={createReward} className="card">
        <h2>🍕 Food or custom reward</h2>
        <input type="hidden" name="from" value="/rewards/new" />
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
          Type
          <select name="kind" defaultValue="food">
            <option value="food">Food</option>
            <option value="game_credit">Game loot</option>
          </select>
        </label>
        <label>
          Game (for game loot)
          <select name="game" defaultValue="">
            <option value="">None</option>
            {GAMES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
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
