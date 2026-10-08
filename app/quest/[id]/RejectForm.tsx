"use client";

import { useState } from "react";
import { MAX_REJECTION_CHARS, REJECTION_CHIPS } from "@/lib/approval";
import { submitReview } from "../actions";

// A chip-prefilled note reads "<chip>" or "<chip> — <the giver's words>".
const SEP = " — ";
const chipOf = (note: string) => REJECTION_CHIPS.find((c) => note === c || note.startsWith(c + SEP));
const withChip = (chip: string, note: string) => {
  const current = chipOf(note);
  const rest = (current ? note.slice(current.length + SEP.length) : note).trim();
  return (rest ? chip + SEP + rest : chip).slice(0, MAX_REJECTION_CHARS);
};

/**
 * "Ask to redo": a quick-pick chip prefills the note, but the note itself is
 * always required and editable — it's what the player sees on their redo
 * screen. submitReview and approve_run both re-check it.
 */
export default function RejectForm({ runId }: { runId: string }) {
  const [note, setNote] = useState("");
  const picked = chipOf(note);

  return (
    <form action={submitReview} className="reject-form">
      <input type="hidden" name="id" value={runId} />
      <input type="hidden" name="decision" value="redo" />
      <h3>🔁 Not quite? Tell them what to fix</h3>
      <div className="reject-chips" role="group" aria-label="Quick picks">
        {REJECTION_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            className={`reject-chip ${picked === chip ? "on" : ""}`}
            aria-pressed={picked === chip}
            // Swaps the chip prefix; whatever the giver typed stays.
            onClick={() => setNote((n) => withChip(chip, n))}
          >
            {chip}
          </button>
        ))}
      </div>
      <label>
        <span className="sr-only">What to fix</span>
        <textarea
          name="reason"
          required
          maxLength={MAX_REJECTION_CHARS}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. The towels are still on the floor by the door."
        />
      </label>
      <p className="muted char-count">
        {note.trim().length}/{MAX_REJECTION_CHARS}
      </p>
      <button type="submit" className="redo-button" disabled={note.trim().length === 0}>
        🔁 Send back for a redo
      </button>
    </form>
  );
}
