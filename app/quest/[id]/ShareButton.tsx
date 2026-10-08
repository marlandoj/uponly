"use client";

import { useState } from "react";

// Native share sheet on phones; falls back to copying the link.
export default function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Celebrate my quest on ChoreQuest", url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard blocked; the link is shown on screen anyway.
    }
  }

  return (
    <button type="button" className="secondary" onClick={share}>
      {copied ? "Link copied" : "Share link"}
    </button>
  );
}
