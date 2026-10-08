import { describe, expect, it } from "vitest";
import {
  APPROVAL_MODES,
  MAX_COMMENT_CHARS,
  MAX_REJECTION_CHARS,
  REJECTION_CHIPS,
  canPostComment,
  canReviewRun,
  nextAttemptNo,
  parseApprovalMode,
  parseCommentBody,
  parseRejectionReason,
  reviewQueue,
  routeAfterSubmit,
  type ReviewableRun,
} from "./approval";
import type { Verification } from "./rating";

const VERDICTS: (Verification | null)[] = ["pass", "unclear", "fail", "photo-only", null];

describe("routeAfterSubmit", () => {
  it("ai_instant + AI pass drops rewards instantly", () => {
    expect(routeAfterSubmit("ai_instant", "pass")).toBe("instant");
  });

  it("every other ai_instant verdict waits for a giver (null = clip / no check)", () => {
    for (const v of VERDICTS.filter((v) => v !== "pass")) {
      expect(routeAfterSubmit("ai_instant", v)).toBe("pending");
    }
  });

  it("giver_approves always waits, even on an AI pass", () => {
    for (const v of VERDICTS) expect(routeAfterSubmit("giver_approves", v)).toBe("pending");
  });
});

describe("parseApprovalMode", () => {
  it("accepts both modes and defaults everything else to ai_instant", () => {
    for (const m of APPROVAL_MODES) expect(parseApprovalMode(m)).toBe(m);
    expect(parseApprovalMode(null)).toBe("ai_instant");
    expect(parseApprovalMode("")).toBe("ai_instant");
    expect(parseApprovalMode("parent_only")).toBe("ai_instant");
  });
});

describe("canReviewRun (mirrors approve_run)", () => {
  const PLAYER = "11111111-1111-1111-1111-111111111111";
  const GIVER = "22222222-2222-2222-2222-222222222222";
  const pending: ReviewableRun = { user_id: PLAYER, status: "completed", approval_status: "pending" };

  it("a circle-mate can review a pending finish", () => {
    expect(canReviewRun(GIVER, true, pending)).toEqual({ ok: true });
  });

  it("blocks non-members", () => {
    expect(canReviewRun(GIVER, false, pending)).toEqual({ ok: false, reason: "not_member" });
  });

  it("the player cannot approve their own run", () => {
    expect(canReviewRun(PLAYER, true, pending)).toEqual({ ok: false, reason: "own_run" });
  });

  it("blocks runs that aren't completed + pending", () => {
    for (const run of [
      { ...pending, status: "active" },
      { ...pending, status: "draft" },
      { ...pending, status: "abandoned" },
      { ...pending, approval_status: "approved" as const },
      { ...pending, approval_status: "rejected" as const },
      { ...pending, status: "active", approval_status: "rejected" as const },
    ]) {
      expect(canReviewRun(GIVER, true, run)).toEqual({ ok: false, reason: "not_pending" });
    }
  });
});

describe("comments", () => {
  it("trims and accepts 1–500 chars", () => {
    expect(parseCommentBody("  nice work!  ")).toEqual({ ok: true, body: "nice work!" });
    expect(parseCommentBody("x")).toEqual({ ok: true, body: "x" });
    expect(parseCommentBody("x".repeat(MAX_COMMENT_CHARS))).toMatchObject({ ok: true });
  });

  it("rejects empty, whitespace-only, too long and non-string bodies", () => {
    expect(MAX_COMMENT_CHARS).toBe(500);
    expect(parseCommentBody("")).toMatchObject({ ok: false });
    expect(parseCommentBody("   \n ")).toMatchObject({ ok: false });
    expect(parseCommentBody("x".repeat(501))).toMatchObject({ ok: false });
    expect(parseCommentBody(null)).toMatchObject({ ok: false });
    expect(parseCommentBody(42)).toMatchObject({ ok: false });
  });

  it("members post only as themselves", () => {
    expect(canPostComment("a", "a", true)).toBe(true);
    expect(canPostComment("a", "b", true)).toBe(false);
    expect(canPostComment("a", "a", false)).toBe(false);
  });
});

describe("reviewQueue (home page 'Waiting for review')", () => {
  const PLAYER = "11111111-1111-1111-1111-111111111111";
  const GIVER = "22222222-2222-2222-2222-222222222222";
  const run = (id: string, over: Partial<ReviewableRun & { completed_at: string }> = {}) => ({
    id,
    user_id: PLAYER,
    status: "completed",
    approval_status: "pending" as const,
    completed_at: "2026-10-08T10:00:00Z",
    ...over,
  });

  it("a pending finish shows up for a circle-mate giver", () => {
    expect(reviewQueue(GIVER, true, [run("a")]).map((r) => r.id)).toEqual(["a"]);
  });

  it("is hidden from the run's owner", () => {
    expect(reviewQueue(PLAYER, true, [run("a")])).toEqual([]);
  });

  it("is hidden once approved (or rejected, or not finished)", () => {
    expect(
      reviewQueue(GIVER, true, [
        run("approved", { approval_status: "approved" }),
        run("rejected", { status: "active", approval_status: "rejected" }),
        run("active", { status: "active" }),
      ]),
    ).toEqual([]);
  });

  it("is empty for non-members", () => {
    expect(reviewQueue(GIVER, false, [run("a")])).toEqual([]);
  });

  it("lists newest finishes first and skips the viewer's own", () => {
    const queue = reviewQueue(GIVER, true, [
      run("old", { completed_at: "2026-10-07T09:00:00Z" }),
      run("mine", { user_id: GIVER, completed_at: "2026-10-08T12:00:00Z" }),
      run("new", { completed_at: "2026-10-08T11:00:00Z" }),
    ]);
    expect(queue.map((r) => r.id)).toEqual(["new", "old"]);
  });
});

describe("parseRejectionReason (mirrors approve_run's p_reason)", () => {
  it("trims and accepts 1–300 chars, including a bare quick-pick chip", () => {
    expect(parseRejectionReason("  Towels still on the floor  ")).toEqual({ ok: true, reason: "Towels still on the floor" });
    for (const chip of REJECTION_CHIPS) expect(parseRejectionReason(chip)).toEqual({ ok: true, reason: chip });
    expect(parseRejectionReason("x".repeat(MAX_REJECTION_CHARS))).toMatchObject({ ok: true });
  });

  it("requires a note: empty, whitespace-only, missing and too long are rejected", () => {
    expect(MAX_REJECTION_CHARS).toBe(300);
    for (const bad of ["", "   \n\t ", null, undefined, 42, "x".repeat(301)]) {
      expect(parseRejectionReason(bad)).toMatchObject({ ok: false });
    }
  });
});

describe("nextAttemptNo (mirrors complete_quest)", () => {
  it("a first submit stays attempt 1", () => {
    expect(nextAttemptNo({ attempt_no: 1, approval_status: "pending" })).toBe(1);
  });

  it("each resubmit after a rejection is the next attempt", () => {
    let run = { attempt_no: 1, approval_status: "rejected" as const };
    expect(nextAttemptNo(run)).toBe(2);
    run = { attempt_no: nextAttemptNo(run), approval_status: "rejected" };
    expect(nextAttemptNo(run)).toBe(3);
  });

  it("never increments without a rejection", () => {
    expect(nextAttemptNo({ attempt_no: 2, approval_status: "pending" })).toBe(2);
    expect(nextAttemptNo({ attempt_no: 2, approval_status: "approved" })).toBe(2);
  });
});
