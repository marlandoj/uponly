"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { questComplete } from "@/lib/sfx";

const CONFETTI = Array.from({ length: 28 }, (_, i) => i);
const SHOW_MS = 2600;

/** localStorage key marking a run's completion as already celebrated. */
export const celebratedKey = (runId: string) => `cq-celebrated-${runId}`;

/** Confetti burst + "QUEST COMPLETE!" banner. Decorative, never takes taps. */
export function QuestCompleteBurst() {
  return (
    <div className="fx-overlay fx-complete" aria-hidden="true">
      <div className="fx-confetti">
        {CONFETTI.map((i) => (
          <span
            key={i}
            style={
              {
                "--fx-x": `${((i * 53) % 90) - 45}vw`,
                "--fx-r": `${(i * 97) % 720}deg`,
                animationDelay: `${(i % 5) * 0.04}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <p className="fx-banner">QUEST COMPLETE!</p>
    </div>
  );
}

/**
 * Fires once per completed run on mount: the victory jingle plus a confetti
 * banner (sound only under reduced motion). Later visits stay quiet.
 */
export default function CelebrationFx({ runId }: { runId: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(celebratedKey(runId))) return;
      window.localStorage.setItem(celebratedKey(runId), "1");
    } catch {
      // No storage: celebrate anyway.
    }
    questComplete();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShow(true);
  }, [runId]);

  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => setShow(false), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [show]);

  return show ? <QuestCompleteBurst /> : null;
}
