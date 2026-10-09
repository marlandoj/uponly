"use client";

import { useEffect, useRef, useState, type AnimationEvent, type CSSProperties } from "react";
import "./chore-crew.css";

/** Sprite names — must match SPRITES in scripts/pixel-sprite.mjs. */
export const CREW = ["plumber", "runner", "miner", "marine"] as const;
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

export const SPAWN_MIN_MS = 25_000;
export const SPAWN_MAX_MS = 60_000;

const between = (rand: () => number, min: number, max: number) => min + rand() * (max - min);

/** Wait before the next walker appears. */
export const nextDelay = (rand: () => number = Math.random) => between(rand, SPAWN_MIN_MS, SPAWN_MAX_MS);

/** A random crew member, lane, direction and pace. */
export function pickWalk(id: number, rand: () => number = Math.random): Walk {
  return {
    id,
    who: CREW[Math.min(CREW.length - 1, Math.floor(rand() * CREW.length))],
    lane: Math.round(between(rand, 1, 22) * 10) / 10,
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
 * Ambient "Chore Crew": every 25–60s a pixel-art gamer wanders across the
 * bottom of the screen doing a chore. Decorative only — hidden from assistive
 * tech, never takes pointer input, renders nothing under reduced motion.
 */
export default function ChoreCrew() {
  const [enabled, setEnabled] = useState(false);
  const [walk, setWalk] = useState<Walk | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setEnabled(!mq.matches);
      if (mq.matches) setWalk(null);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // One walker at a time: the next spawn is only scheduled once the stage is empty.
  useEffect(() => {
    if (!enabled || walk) return;
    const timer = window.setTimeout(() => setWalk(pickWalk(nextId.current++)), nextDelay());
    return () => window.clearTimeout(timer);
  }, [enabled, walk]);

  if (!enabled) return null;
  return (
    <div className="chore-crew" aria-hidden="true">
      {walk && <CrewWalker key={walk.id} walk={walk} onDone={() => setWalk(null)} />}
    </div>
  );
}
