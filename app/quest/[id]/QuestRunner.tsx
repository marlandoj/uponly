"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { checkEvidence } from "@/lib/evidence";
import { MIN_QUEST_SECONDS, formatClock, secondsUntilUnlock } from "@/lib/quests";
import CameraCapture from "./CameraCapture";

type Props = {
  runId: string;
  status: "draft" | "active";
  startedAt: string | null;
  /** Server clock at render time, used to correct for a skewed device clock. */
  serverNow: number;
  /** A giver asked for a redo: only the after evidence is re-shot. */
  redo?: boolean;
  /** The giver's "what to fix" note for that redo. */
  rejectionReason?: string | null;
};

export default function QuestRunner({ runId, status, startedAt, serverNow, redo = false, rejectionReason = null }: Props) {
  const router = useRouter();
  // Captured once on mount; the server re-checks the 4-minute rule regardless.
  const [skew] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(() => Date.now() + skew);

  useEffect(() => {
    if (status !== "active") return;
    const t = setInterval(() => setNow(Date.now() + skew), 500);
    return () => clearInterval(t);
  }, [status, skew]);

  async function upload(kind: "before" | "after", evidence: Blob) {
    const type = checkEvidence(evidence.type, evidence.size);
    if (!type.ok) throw new Error(type.error);
    const body = new FormData();
    body.set("kind", kind);
    body.set("photo", evidence, `${kind}.${type.ext}`);
    const res = await fetch(`/api/quests/${runId}/photo`, { method: "POST", body });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Upload failed." }));
      throw new Error(error);
    }
    router.refresh();
  }

  if (status === "draft") {
    return (
      <section className="card">
        <h2>1 · Before photo</h2>
        <p>Snap the space as it is now. The quest timer starts when it uploads.</p>
        <CameraCapture label="Open camera" onCapture={(p) => upload("before", p)} />
      </section>
    );
  }

  const startedMs = Date.parse(startedAt!);
  const elapsed = Math.max(0, (now - startedMs) / 1000);
  const wait = secondsUntilUnlock(startedMs, now);
  const progress = Math.min(1, elapsed / MIN_QUEST_SECONDS);

  if (redo) {
    return (
      <section className="card redo">
        <h2>🔁 Asked to redo</h2>
        {rejectionReason && (
          <div className="fix-callout" role="status">
            <p className="fix-callout-title">Not quite — here&apos;s what to fix:</p>
            <p className="fix-callout-reason">{rejectionReason}</p>
          </div>
        )}
        <p>{rejectionReason ? "Fix it up" : "Your reviewer wants another look. Finish it up"}, then take another after photo or clip.</p>
        <CameraCapture label="Open camera" busyLabel="Uploading…" onCapture={(p) => upload("after", p)} />
      </section>
    );
  }

  return (
    <section className="card">
      <h2>2 · Do the chore</h2>
      <p className="timer" aria-live="polite">{formatClock(elapsed)}</p>
      <div
        className="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={MIN_QUEST_SECONDS}
        aria-valuenow={Math.floor(Math.min(elapsed, MIN_QUEST_SECONDS))}
      >
        <div style={{ width: `${progress * 100}%` }} />
      </div>
      {wait > 0 ? (
        <p className="muted">After photo unlocks in {formatClock(wait)} — quests take at least 4 minutes.</p>
      ) : (
        <p className="notice">Ready when you are. Snap or film the finished result.</p>
      )}
      <h2>3 · After photo</h2>
      <CameraCapture
        label={wait > 0 ? `Unlocks in ${formatClock(wait)}` : "Open camera"}
        busyLabel="Uploading & checking…"
        disabled={wait > 0}
        onCapture={(p) => upload("after", p)}
      />
    </section>
  );
}
