import { bossState } from "@/lib/boss";
import { formatLevel } from "@/lib/rating";

/** Boss HP bar driven by total XP. */
export function BossBar({ xp }: { xp: number }) {
  const boss = bossState(xp);
  return (
    <div className="boss">
      <p>
        <strong>👾 {boss.name}</strong>
        <span className="muted"> · HP {boss.hp}/{boss.maxHp}</span>
        {boss.defeated > 0 && <span className="muted"> · {boss.defeated} defeated</span>}
      </p>
      <div
        className="progress boss-hp"
        role="progressbar"
        aria-label={`${boss.name} HP`}
        aria-valuemin={0}
        aria-valuemax={boss.maxHp}
        aria-valuenow={boss.hp}
      >
        <div style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} />
      </div>
    </div>
  );
}

/** "Sam's chore level 3.50 → 3.58 ▲" with a CSS pop on the new value. */
export function LevelTick({ label, from, to }: { label: string; from: number | null; to: number | null }) {
  if (from == null || to == null) return null;
  const up = Number(to) > Number(from);
  return (
    <p className="level-tick">
      {label} <span className="from">{formatLevel(Number(from))}</span>
      {up && (
        <>
          {" → "}
          <span className="to">{formatLevel(Number(to))} ▲</span>
        </>
      )}
    </p>
  );
}
