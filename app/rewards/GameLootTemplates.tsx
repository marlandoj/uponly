import {
  centsToDollarInput,
  CUSTOM_TEMPLATE_ID,
  GAME_CREDIT_TEMPLATES,
  templateToRewardInput,
} from "@/lib/gameRewards";
import { resolveLootSprite } from "@/lib/lootSprites";
import { formatCents, GAMES } from "@/lib/rewards";
import { createReward } from "./actions";

/**
 * One-tap game credit packs (any quest earns them) plus a custom amount.
 * Each tap is a create_reward call; the gamer gets a (mock) gift card, never an
 * in-game purchase.
 */
export default function GameLootTemplates({ from }: { from: "/rewards/new" | "/rewards/shop" }) {
  const packs = GAME_CREDIT_TEMPLATES.filter((t) => t.id !== CUSTOM_TEMPLATE_ID);
  const custom = GAME_CREDIT_TEMPLATES.find((t) => t.id === CUSTOM_TEMPLATE_ID)!;
  const customInput = templateToRewardInput(custom);

  return (
    <>
      <ul className="loot-grid">
        {packs.map((t) => {
          const r = templateToRewardInput(t);
          const sprite = resolveLootSprite(r);
          return (
            <li key={t.id}>
              <form action={createReward} className="loot-tile">
                <RewardFields from={from} input={r} />
                {/* eslint-disable-next-line @next/next/no-img-element -- static pixel sprite */}
                {sprite && <img src={sprite} alt="" width={64} height={64} className="pixel" />}
                <strong>{t.label}</strong>
                {t.valueCents != null && <span className="muted">~{formatCents(t.valueCents)} gift card</span>}
                <button type="submit">Add</button>
              </form>
            </li>
          );
        })}
      </ul>

      <form action={createReward} className="card">
        <h2>Custom amount</h2>
        <input type="hidden" name="from" value={from} />
        <input type="hidden" name="kind" value="game_credit" />
        <input type="hidden" name="fulfillment" value={customInput.fulfillment} />
        <input type="hidden" name="description" value={customInput.description} />
        <label>
          Loot
          <input name="name" maxLength={60} placeholder="250 Robux" required />
        </label>
        <label>
          Game
          <select name="game" defaultValue="Roblox" required>
            {GAMES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
        <label>
          Gift card value in dollars
          <input name="value" inputMode="decimal" pattern="\$?\d{1,4}(\.\d{1,2})?" placeholder="5.00" />
        </label>
        <button type="submit" className="secondary">Add custom loot</button>
      </form>
    </>
  );
}

/** Hidden fields for a prefilled game credit reward (any quest). */
export function RewardFields({
  from,
  input,
}: {
  from: string;
  input: { name: string; description: string; valueCents: number | null; fulfillment: string; kind: string; game: string };
}) {
  return (
    <>
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="name" value={input.name} />
      <input type="hidden" name="description" value={input.description} />
      <input type="hidden" name="value" value={centsToDollarInput(input.valueCents)} />
      <input type="hidden" name="fulfillment" value={input.fulfillment} />
      <input type="hidden" name="kind" value={input.kind} />
      <input type="hidden" name="game" value={input.game} />
      <input type="hidden" name="quest" value="" />
    </>
  );
}
