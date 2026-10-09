"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isMuted, startMusic, stopMusic, subscribe, toggleMute } from "@/lib/sfx";

/**
 * Floating sound toggle (bottom-right) that also owns the background loop:
 * the loop starts on the first user gesture (autoplay policy), pauses while
 * the tab is hidden, and stays silent while muted.
 */
export default function MusicToggle() {
  const muted = useSyncExternalStore(subscribe, isMuted, () => false);

  useEffect(() => {
    let armed = false;
    const onGesture = () => {
      armed = true;
      startMusic();
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
    const onVisibility = () => {
      if (!armed) return;
      if (document.hidden) stopMusic();
      else startMusic();
    };
    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      document.removeEventListener("visibilitychange", onVisibility);
      stopMusic();
    };
  }, []);

  return (
    <button
      type="button"
      className="sound-toggle"
      aria-label={muted ? "Sound off — turn sound on" : "Sound on — turn sound off"}
      aria-pressed={!muted}
      onClick={() => toggleMute()}
    >
      <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
    </button>
  );
}
