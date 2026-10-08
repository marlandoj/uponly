import type { Verification } from "@/lib/rating";

// Who approves a finished quest, and what happens when they do. This is the
// reference copy; 0009_visual_verification.sql (approve_run,
// mark_run_ai_approved, run_comments) is the enforcing copy.

export const APPROVAL_MODES = ["ai_instant", "giver_approves"] as const;
export type ApprovalMode = (typeof APPROVAL_MODES)[number];
export type ApprovalStatus = "pending" | "approved" | "rejected";

export const isApprovalMode = (v: unknown): v is ApprovalMode =>
  typeof v === "string" && (APPROVAL_MODES as readonly string[]).includes(v);

/** Form value → mode; anything missing or unknown falls back to the default. */
export const parseApprovalMode = (v: unknown): ApprovalMode => (isApprovalMode(v) ? v : "ai_instant");

/**
 * After the after evidence lands: an AI 'pass' on an ai_instant run approves
 * it and drops rewards now. Everything else — giver_approves, any other
 * verdict, or a clip (no AI check, verification null) — waits for a giver.
 */
export function routeAfterSubmit(mode: ApprovalMode, verification: Verification | null): "instant" | "pending" {
  return mode === "ai_instant" && verification === "pass" ? "instant" : "pending";
}

export type ReviewableRun = {
  user_id: string;
  status: string;
  approval_status: ApprovalStatus;
};

export type ReviewCheck = { ok: true } | { ok: false; reason: "not_member" | "own_run" | "not_pending" };

/** Mirrors approve_run: another member of the run's circle, while the finish is pending. */
export function canReviewRun(viewerId: string, isCircleMember: boolean, run: ReviewableRun): ReviewCheck {
  if (!isCircleMember) return { ok: false, reason: "not_member" };
  if (run.user_id === viewerId) return { ok: false, reason: "own_run" };
  if (run.status !== "completed" || run.approval_status !== "pending") return { ok: false, reason: "not_pending" };
  return { ok: true };
}

export const MAX_COMMENT_CHARS = 500;

/** Trimmed comment body (1–500 chars, matching run_comments.body), or an error. */
export function parseCommentBody(raw: unknown): { ok: true; body: string } | { ok: false; error: string } {
  const body = typeof raw === "string" ? raw.trim() : "";
  if (body.length === 0) return { ok: false, error: "Write something first" };
  if (body.length > MAX_COMMENT_CHARS) return { ok: false, error: `Keep it under ${MAX_COMMENT_CHARS} characters` };
  return { ok: true, body };
}

/** Mirrors the run_comments insert policy: circle members, posting as themselves. */
export function canPostComment(viewerId: string, authorId: string, isCircleMember: boolean): boolean {
  return isCircleMember && viewerId === authorId;
}
