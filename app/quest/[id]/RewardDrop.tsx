"use client";

import { useState } from "react";
import { resolveLootSprite } from "@/lib/lootSprites";
import type { EarnedReward } from "@/lib/rewards";

const CONFETTI = Array.from({ length: 24 }, (_, i) => i);

/**
 * "REWARD EARNED!" — full-screen arcade drop the first time the completed
 * quest page loads (fresh), then a card that stays on the page. Game credit
 * drops read "LOOT EARNED!" and lead with their pixel sprite.
 */
export default function RewardDrop({ rewards, fresh }: { rewards: EarnedReward[]; fresh: boolean }) {
  const [open, setOpen] = useState(fresh);
  if (rewards.length === 0) return null;
  const loot = rewards.find((r) => r.kind === "game_credit");
  const lootSprite = loot ? resolveLootSprite(loot) : null;

  return (
    <>
      {open && (
        <div className="reward-drop" role="dialog" aria-modal="true" aria-labelledby="reward-drop-title">
          <div className="confetti" aria-hidden="true">
            {CONFETTI.map((i) => (
              <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 0.15}s` }} />
            ))}
          </div>
          {lootSprite ? (
            // eslint-disable-next-line @next/next/no-img-element -- static pixel sprite
            <img className="reward-drop-burst pixel loot-sprite" src={lootSprite} alt="" width={160} height={160} />
          ) : (
            <p className="reward-drop-burst" aria-hidden="true">{loot ? "🎮" : "🍕"}</p>
          )}
          <h1 id="reward-drop-title" className="reward-drop-title">{loot ? "LOOT EARNED!" : "REWARD EARNED!"}</h1>
          <ul className="reward-drop-list">
            {rewards.map((r) => (
              <li key={r.earningId}>
                <RewardLine reward={r} big />
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setOpen(false)}>Claim it!</button>
        </div>
      )}

      <section className="card reward-card">
        <h2>{loot ? "🎮 Loot earned" : "🎁 Rewards earned"}</h2>
        <ul className="reward-drop-list">
          {rewards.map((r) => (
            <li key={r.earningId}>
              <RewardLine reward={r} />
            </li>
          ))}
        </ul>
        <p className="muted">Demo mode: gift codes and orders are mock — nothing is charged or delivered.</p>
      </section>
    </>
  );
}

function RewardLine({ reward, big = false }: { reward: EarnedReward; big?: boolean }) {
  const giftCode = reward.fulfillment === "mock-tremendous" && reward.status === "fulfilled" ? reward.ref : null;
  const sprite = big ? null : resolveLootSprite(reward);
  return (
    <div className={`reward-line${big ? " big" : ""}`}>
      <p className="reward-name">
        {/* eslint-disable-next-line @next/next/no-img-element -- static pixel sprite */}
        {sprite && <img className="pixel inline-sprite" src={sprite} alt="" width={28} height={28} />}
        {reward.kind === "game_credit" && reward.game ? `${reward.name} · ${reward.game}` : reward.name}
      </p>
      {giftCode ? (
        <>
          <p className="code">{giftCode}</p>
          <p className="muted">Mock gift code — not redeemable</p>
        </>
      ) : reward.etaMinutes != null ? (
        <>
          <p className="notice">{reward.displayText} · arriving in ~{reward.etaMinutes} min</p>
          {reward.ref && <p className="muted">Order {reward.ref} (mock)</p>}
        </>
      ) : (
        <p className="notice">{reward.displayText}</p>
      )}
    </div>
  );
}
