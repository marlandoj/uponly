"use client";

import { useEffect, useState, type ReactNode } from "react";
import { questStart } from "@/lib/sfx";

const PARTICLES = Array.from({ length: 16 }, (_, i) => i);
const SHOW_MS = 2000;

/** Full-screen "QUEST START!" flash: expanding rings + rising particles. Decorative, never takes taps. */
export function QuestStartBurst() {
  return (
    <div className="fx-overlay fx-start" aria-hidden="true">
      <span className="fx-ring" />
      <span className="fx-ring" />
      <span className="fx-ring" />
      <div className="fx-particles">
        {PARTICLES.map((i) => (
          <span key={i} style={{ left: `${(i * 41 + 7) % 100}%`, animationDelay: `${(i % 6) * 0.08}s` }} />
        ))}
      </div>
      <p className="fx-title">QUEST START!</p>
    </div>
  );
}

/**
 * The quest picker form. On submit it plays the power-up and flashes the
 * overlay, then lets the server action submit as normal (no preventDefault).
 */
export default function QuestStartForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
  children: ReactNode;
}) {
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!burst) return;
    const t = window.setTimeout(() => setBurst(0), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [burst]);

  return (
    <form
      action={action}
      className={className}
      onSubmit={() => {
        questStart();
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setBurst((n) => n + 1);
      }}
    >
      {children}
      {burst > 0 && <QuestStartBurst key={burst} />}
    </form>
  );
}
