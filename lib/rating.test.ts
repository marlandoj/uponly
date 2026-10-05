import { describe, expect, it } from "vitest";
import {
  BASE_LEVEL,
  CELEBRATION_XP,
  COMPLETION_XP,
  type LedgerEvent,
  type Rating,
  type Verification,
  accumulate,
  createLedger,
  dayKey,
  formatLevel,
  isRating,
  levelFromScore,
  scoreIncrement,
  verificationWeight,
} from "./rating";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 5, 12); // Mon Oct 5 2026, noon UTC

const done = (id: string, playerId: string, at = T0, verification: Verification = "pass"): LedgerEvent => ({
  kind: "completion",
  completionId: id,
  playerId,
  at,
  verification,
});
const rate = (completionId: string, raterId: string, rating: Rating, at = T0 + 1): LedgerEvent => ({
  kind: "rating",
  completionId,
  raterId,
  rating,
  at,
});

describe("level formula", () => {
  it("starts at 3.50 and approaches 5.00 from below", () => {
    expect(levelFromScore(0)).toBe(BASE_LEVEL);
    expect(levelFromScore(1)).toBeCloseTo(3.5 + 1.5 * (1 - Math.exp(-1)), 12);
    expect(levelFromScore(50)).toBeLessThanOrEqual(5);
    expect(levelFromScore(50)).toBeGreaterThan(4.99);
    expect(formatLevel(levelFromScore(0))).toBe("3.50");
  });

  it("clamps negative scores so the level never drops below base", () => {
    expect(levelFromScore(-5)).toBe(BASE_LEVEL);
  });

  it("weights ratings by (rating − 3) × 0.06 × verification", () => {
    expect(verificationWeight("pass")).toBe(1);
    expect(verificationWeight("unclear")).toBe(0.8);
    expect(verificationWeight("photo-only")).toBe(0.8);
    expect(verificationWeight("fail")).toBe(0.8);
    expect(scoreIncrement(3, "pass")).toBe(0);
    expect(scoreIncrement(4, "pass")).toBeCloseTo(0.06, 12);
    expect(scoreIncrement(5, "pass")).toBeCloseTo(0.12, 12);
    expect(scoreIncrement(5, "unclear")).toBeCloseTo(0.096, 12);
    expect(scoreIncrement(4, "photo-only")).toBeCloseTo(0.048, 12);
  });

  it("only accepts 3/4/5 ratings", () => {
    for (const n of [3, 4, 5]) expect(isRating(n)).toBe(true);
    for (const n of [0, 1, 2, 6, 4.5, "5", null]) expect(isRating(n)).toBe(false);
  });
});

describe("XP", () => {
  it("awards +10 per completion and +2/+4/+6 celebration to the completer", () => {
    expect(CELEBRATION_XP).toEqual({ 3: 2, 4: 4, 5: 6 });
    const { ledger, outcomes } = accumulate([done("c1", "ann"), rate("c1", "bo", 5), rate("c1", "cy", 3)]);
    expect(outcomes.map((o) => o.outcome)).toEqual([
      { counted: true, playerId: "ann", xp: COMPLETION_XP, scoreDelta: 0 },
      { counted: true, playerId: "ann", xp: 6, scoreDelta: scoreIncrement(5, "pass") },
      { counted: true, playerId: "ann", xp: 2, scoreDelta: 0 },
    ]);
    const ann = ledger.standing("ann");
    expect(ann.xp).toBe(10 + 6 + 2);
    expect(ann.ratingsReceived).toBe(2);
    expect(ann.level).toBeCloseTo(levelFromScore(0.12), 12);
    // Raters earn nothing from rating.
    expect(ledger.standing("bo").xp).toBe(0);
  });

  it("uses the completion's verification for the level, not the XP", () => {
    const { ledger } = accumulate([done("c1", "ann", T0, "unclear"), rate("c1", "bo", 5)]);
    expect(ledger.standing("ann").xp).toBe(16);
    expect(ledger.standing("ann").score).toBeCloseTo(0.096, 12);
  });
});

describe("caps", () => {
  it("counts at most 2 ratings per completion", () => {
    const { ledger, outcomes } = accumulate([
      done("c1", "ann"),
      rate("c1", "bo", 5),
      rate("c1", "cy", 5),
      rate("c1", "di", 5),
    ]);
    expect(outcomes[3].outcome).toEqual({ counted: false, reason: "completion_rating_cap" });
    expect(ledger.standing("ann").xp).toBe(10 + 6 + 6);
    expect(ledger.standing("ann").ratingsReceived).toBe(2);
  });

  it("rejects self-ratings and repeat ratings by the same rater", () => {
    const { ledger, outcomes } = accumulate([
      done("c1", "ann"),
      rate("c1", "ann", 5),
      rate("c1", "bo", 4),
      rate("c1", "bo", 5),
    ]);
    expect(outcomes[1].outcome).toEqual({ counted: false, reason: "self_rating" });
    expect(outcomes[3].outcome).toEqual({ counted: false, reason: "already_rated" });
    expect(ledger.standing("ann").xp).toBe(14);
  });

  it("counts at most 5 ratings per rater per day, resetting the next day", () => {
    const events: LedgerEvent[] = [];
    for (let i = 0; i < 7; i++) {
      // Different completers so no one hits the 3-completions/day cap.
      events.push(done(`c${i}`, `p${i}`, T0), rate(`c${i}`, "bo", 4, T0 + 1000 + i));
    }
    events.push(done("next", "p0", T0 + DAY), rate("next", "bo", 4, T0 + DAY + 1));
    const { ledger, outcomes } = accumulate(events);
    const bo = outcomes.filter((o) => o.event.kind === "rating").map((o) => o.outcome.counted);
    expect(bo).toEqual([true, true, true, true, true, false, false, true]);
    expect(outcomes.find((o) => o.event.kind === "rating" && o.event.completionId === "c5")?.outcome).toEqual({
      counted: false,
      reason: "rater_daily_cap",
    });
    expect(ledger.standing("p5").xp).toBe(10);
    expect(ledger.standing("p0").xp).toBe(10 + 4 + 10 + 4);
  });

  it("does not spend a rater's daily quota on rejected ratings", () => {
    const events: LedgerEvent[] = [done("own", "bo"), rate("own", "bo", 5)];
    for (let i = 0; i < 5; i++) events.push(done(`c${i}`, `p${i}`), rate(`c${i}`, "bo", 5, T0 + 10 + i));
    const { outcomes } = accumulate(events);
    const counted = outcomes.filter((o) => o.event.kind === "rating" && o.outcome.counted);
    expect(counted).toHaveLength(5);
  });

  it("credits at most 3 completions per player per day; extra ones are not rateable", () => {
    const { ledger, outcomes } = accumulate([
      done("a", "ann", T0),
      done("b", "ann", T0 + 1),
      done("c", "ann", T0 + 2),
      done("d", "ann", T0 + 3),
      rate("d", "bo", 5, T0 + 4),
      done("e", "ann", T0 + DAY),
    ]);
    expect(outcomes.map((o) => o.outcome.counted)).toEqual([true, true, true, false, false, true]);
    expect(outcomes[3].outcome).toEqual({ counted: false, reason: "daily_completion_cap" });
    expect(outcomes[4].outcome).toEqual({ counted: false, reason: "completion_not_credited" });
    const ann = ledger.standing("ann");
    expect(ann.xp).toBe(40);
    expect(ann.completions).toBe(5);
    expect(ann.creditedCompletions).toBe(4);
  });

  it("buckets days by the configured timezone offset", () => {
    // 23:30 and 00:30 UTC are the same local day at UTC−5.
    const late = Date.UTC(2026, 9, 5, 23, 30);
    const early = Date.UTC(2026, 9, 6, 0, 30);
    expect(dayKey(late)).not.toBe(dayKey(early));
    expect(dayKey(late, -300)).toBe(dayKey(early, -300));
    const events = [done("a", "ann", late - 2), done("b", "ann", late - 1), done("c", "ann", late), done("d", "ann", early)];
    expect(accumulate(events).ledger.standing("ann").creditedCompletions).toBe(4);
    expect(accumulate(events, { tzOffsetMinutes: -300 }).ledger.standing("ann").creditedCompletions).toBe(3);
  });
});

describe("ledger", () => {
  it("ignores ratings for unknown completions and duplicate completion ids", () => {
    const ledger = createLedger();
    expect(ledger.apply(rate("ghost", "bo", 5))).toEqual({ counted: false, reason: "unknown_completion" });
    ledger.apply(done("c1", "ann"));
    expect(ledger.apply(done("c1", "ann"))).toEqual({ counted: false, reason: "duplicate_completion" });
    expect(ledger.standing("ann").xp).toBe(10);
    expect(ledger.standing("nobody")).toMatchObject({ xp: 0, level: BASE_LEVEL });
    expect(ledger.standings().map((s) => s.playerId)).toEqual(["ann"]);
  });

  it("rejects out-of-range ratings at runtime", () => {
    const ledger = createLedger();
    ledger.apply(done("c1", "ann"));
    const bad = { kind: "rating", completionId: "c1", raterId: "bo", rating: 1, at: T0 } as unknown as LedgerEvent;
    expect(ledger.apply(bad)).toEqual({ counted: false, reason: "invalid_rating" });
  });

  it("is order-independent for input and sorts completions before ratings on ties", () => {
    const events = [rate("c1", "bo", 5, T0), done("c1", "ann", T0), rate("c1", "cy", 4, T0 + 5)];
    const a = accumulate(events).ledger.standing("ann");
    const b = accumulate([...events].reverse()).ledger.standing("ann");
    expect(a).toEqual(b);
    expect(a.xp).toBe(20);
  });

  it("level is monotone non-decreasing across any rating sequence", () => {
    const ledger = createLedger();
    const ratings: Rating[] = [3, 5, 3, 4, 3, 3, 5, 4];
    const verifs: Verification[] = ["pass", "unclear", "fail", "photo-only"];
    let prev = ledger.standing("ann").level;
    ratings.forEach((r, i) => {
      const at = T0 + i * DAY; // new day each time so no completion cap
      ledger.apply(done(`c${i}`, "ann", at, verifs[i % verifs.length]));
      ledger.apply(rate(`c${i}`, "bo", r, at + 1));
      const lvl = ledger.standing("ann").level;
      expect(lvl).toBeGreaterThanOrEqual(prev);
      prev = lvl;
    });
    expect(prev).toBeGreaterThan(BASE_LEVEL);
    expect(prev).toBeLessThan(5);
  });
});
