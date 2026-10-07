"use client";

import { useState } from "react";
import type { EarnedReward } from "@/lib/rewards";
import { resolveSprite } from "@/lib/sprite";
import Sprite from "../../components/Sprite";

const CONFETTI = Array.from({ length: 24 }, (_, i) => i);

/**
 * "REWARD EARNED!" — full-screen arcade drop the first time the completed
 * quest page loads (fresh), then a card that stays on the page.
 */
export default function RewardDrop({ rewards, fresh }: { rewards: EarnedReward[]; fresh: boolean }) {
  const [open, setOpen] = useState(fresh);
  if (rewards.length === 0) return null;
  const heroSprite = rewards.map((r) => resolveSprite("reward", r.name)).find(Boolean) ?? null;

  return (
    <>
      {open && (
        <div className="reward-drop" role="dialog" aria-modal="true" aria-labelledby="reward-drop-title">
          <div className="confetti" aria-hidden="true">
            {CONFETTI.map((i) => (
              <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 0.15}s` }} />
            ))}
          </div>
          {heroSprite ? (
            <div className="reward-drop-burst reward-drop-sprite" aria-hidden="true">
              <Sprite src={heroSprite} size={192} priority />
            </div>
          ) : (
            <p className="reward-drop-burst" aria-hidden="true">🍕</p>
          )}
          <h1 id="reward-drop-title" className="reward-drop-title">REWARD EARNED!</h1>
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
        <h2>🎁 Rewards earned</h2>
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
  // The overlay already shows the big hero sprite; the card list gets a small one.
  const sprite = big ? null : resolveSprite("reward", reward.name);
  return (
    <div className={`reward-line${big ? " big" : ""}`}>
      {sprite ? (
        <p className="reward-name with-sprite">
          <Sprite src={sprite} size={40} />
          {reward.name}
        </p>
      ) : (
        <p className="reward-name">{reward.name}</p>
      )}
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
