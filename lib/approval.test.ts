import { describe, expect, it } from "vitest";
import {
  APPROVAL_MODES,
  MAX_COMMENT_CHARS,
  canPostComment,
  canReviewRun,
  parseApprovalMode,
  parseCommentBody,
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
