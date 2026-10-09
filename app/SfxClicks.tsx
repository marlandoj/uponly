"use client";

import { useEffect } from "react";
import { click } from "@/lib/sfx";

/** Blips on every button / button-styled link tap. One delegated listener; renders nothing. */
export default function SfxClicks() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target.closest("button, a.button") : null;
      if (el && !(el as HTMLButtonElement).disabled) click();
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);
  return null;
}
