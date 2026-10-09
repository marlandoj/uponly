"use client";

import { useRouter } from "next/navigation";

/**
 * Consistent back button for every page except home.
 * Goes back in history; falls back to `fallback` when there's no history
 * (e.g. deep link opened directly).
 */
export default function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="button secondary back-button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      aria-label="Go back"
    >
      ← Back
    </button>
  );
}
