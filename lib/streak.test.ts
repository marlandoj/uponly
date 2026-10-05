import { describe, expect, it } from "vitest";
import { nextStreak, yesterdayOf } from "./streak";

describe("nextStreak", () => {
  it("keeps the streak when already counted today", () => {
    expect(nextStreak(5, "2026-10-05", "2026-10-05")).toBe(5);
  });
  it("increments when yesterday was the last quest day", () => {
    expect(nextStreak(5, "2026-10-04", "2026-10-05")).toBe(6);
  });
  it("resets to 1 after a missed day", () => {
    expect(nextStreak(5, "2026-10-03", "2026-10-05")).toBe(1);
  });
  it("starts at 1 with no history", () => {
    expect(nextStreak(0, null, "2026-10-05")).toBe(1);
  });
});

describe("yesterdayOf", () => {
  it("handles month boundaries", () => {
    expect(yesterdayOf("2026-10-01")).toBe("2026-09-30");
  });
  it("handles year boundaries", () => {
    expect(yesterdayOf("2026-01-01")).toBe("2025-12-31");
  });
});
