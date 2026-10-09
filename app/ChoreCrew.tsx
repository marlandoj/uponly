"use client";

import { useEffect, useRef, useState, type AnimationEvent, type CSSProperties } from "react";
import "./chore-crew.css";

/** Sprite names — must match SPRITES in scripts/pixel-sprite.mjs. */
export const CREW = ["plumber", "runner", "miner", "marine", "battlehero", "elf", "ghost", "racer"] as const;
export type CrewMember = (typeof CREW)[number];

export type Walk = {
  id: number;
  who: CrewMember;
  /** Distance above the viewport bottom, in vh (keeps the walker in the bottom third). */
  lane: number;
  dir: "ltr" | "rtl";
  /** Seconds to cross the screen. */
  duration: number;
};

export const SPAWN_MIN_MS = 8_000;
export const SPAWN_MAX_MS = 20_000;
/** Most walkers on stage at once. */
export const MAX_WALKERS = 2;
/** Lane bounds (vh) and the minimum gap between two walkers' lanes. */
export const LANE_MIN = 1;
export const LANE_MAX = 22;
export const LANE_GAP = 8;

const between = (rand: () => number, min: number, max: number) => min + rand() * (max - min);

/** Wait before the next walker appears. */
export const nextDelay = (rand: () => number = Math.random) => between(rand, SPAWN_MIN_MS, SPAWN_MAX_MS);

/**
 * A random crew member, lane, direction and pace. Lanes already on stage are
 * avoided: the new lane lands at least LANE_GAP vh from every one of them.
 */
export function pickWalk(id: number, rand: () => number = Math.random, taken: number[] = []): Walk {
  const who = CREW[Math.min(CREW.length - 1, Math.floor(rand() * CREW.length))];
  // Spread the free stretches of the lane range end to end, then map one draw onto them.
  let free: [number, number][] = [[LANE_MIN, LANE_MAX]];
  for (const t of taken) {
    free = free.flatMap(([lo, hi]): [number, number][] =>
      [[lo, Math.min(hi, t - LANE_GAP)], [Math.max(lo, t + LANE_GAP), hi]].filter(([a, b]) => b >= a) as [number, number][],
    );
  }
  const total = free.reduce((sum, [lo, hi]) => sum + (hi - lo), 0);
  let at = rand() * total;
  let lane = free.length > 0 ? free[0][0] : LANE_MIN;
  for (const [lo, hi] of free) {
    if (at <= hi - lo) {
      lane = lo + at;
      break;
    }
    at -= hi - lo;
  }
  return {
    id,
    who,
    lane: Math.round(lane * 10) / 10,
    dir: rand() < 0.5 ? "ltr" : "rtl",
    duration: Math.round(between(rand, 14, 24) * 10) / 10,
  };
}

/** One crew member crossing the screen; calls onDone when the crossing ends. */
export function CrewWalker({ walk, onDone }: { walk: Walk; onDone: () => void }) {
  const style = { "--cc-lane": `${walk.lane}vh`, "--cc-duration": `${walk.duration}s` } as CSSProperties;
  // Inner bob / walk-cycle animations loop forever, so only the crossing ends —
  // but animationend bubbles, so ignore anything that isn't this element.
  const end = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onDone();
  };
  return (
    <div className={`cc-walker cc-walker--${walk.dir}`} style={style} onAnimationEnd={end}>
      <div className="cc-bob">
        <div className="cc-body">
          <div className={`cc-sprite cc-sprite--${walk.who}`} />
        </div>
      </div>
    </div>
  );
}

/**
 * Ambient "Chore Crew": every 8–20s a pixel-art gamer wanders across the
 * bottom of the screen doing a chore, up to two at a time on separate lanes.
 * Decorative only — hidden from assistive tech, never takes pointer input,
 * renders nothing under reduced motion.
 */
export default function ChoreCrew() {
  const [enabled, setEnabled] = useState(false);
  const [walks, setWalks] = useState<Walk[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setEnabled(!mq.matches);
      if (mq.matches) setWalks([]);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // While there's room on stage, schedule the next walker; a full stage waits
  // for someone to finish their crossing.
  const onStage = walks.length;
  useEffect(() => {
    if (!enabled || onStage >= MAX_WALKERS) return;
    const timer = window.setTimeout(
      () =>
        setWalks((ws) =>
          ws.length >= MAX_WALKERS ? ws : [...ws, pickWalk(nextId.current++, Math.random, ws.map((w) => w.lane))],
        ),
      nextDelay(),
    );
    return () => window.clearTimeout(timer);
  }, [enabled, onStage]);

  if (!enabled) return null;
  return (
    <div className="chore-crew" aria-hidden="true">
      {walks.map((walk) => (
        <CrewWalker key={walk.id} walk={walk} onDone={() => setWalks((ws) => ws.filter((w) => w.id !== walk.id))} />
      ))}
    </div>
  );
}
