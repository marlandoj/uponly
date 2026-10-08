import { describe, expect, it } from "vitest";
import {
  CHORE_SIZES,
  choreSizeMeta,
  isChoreSize,
  parseChoreSize,
  sortByCloseness,
  suggestedCentsFor,
} from "./choreTiers";

describe("CHORE_SIZES", () => {
  it("has quick / standard / big with labels, emojis and suggested values", () => {
    expect(CHORE_SIZES.map((s) => [s.id, s.label, s.emoji, s.suggestedCents])).toEqual([
      ["quick", "Quick", "⚡", 500],
      ["standard", "Standard", "🎯", 1500],
      ["big", "Big", "💪", 3000],
    ]);
  });

  it("suggestedCentsFor / choreSizeMeta look up the tier", () => {
    expect(suggestedCentsFor("quick")).toBe(500);
    expect(suggestedCentsFor("standard")).toBe(1500);
    expect(suggestedCentsFor("big")).toBe(3000);
    expect(choreSizeMeta("big").label).toBe("Big");
  });
});

describe("isChoreSize / parseChoreSize", () => {
  it("accepts only the three ids", () => {
    for (const id of ["quick", "standard", "big"]) expect(isChoreSize(id)).toBe(true);
    for (const v of ["huge", "", null, undefined, 1, "Quick"]) expect(isChoreSize(v)).toBe(false);
  });

  it("defaults anything invalid or blank to standard", () => {
    expect(parseChoreSize("quick")).toBe("quick");
    expect(parseChoreSize("big")).toBe("big");
    expect(parseChoreSize(" big ")).toBe("big");
    for (const v of ["huge", "", "  ", null, undefined, 3]) expect(parseChoreSize(v)).toBe("standard");
  });
});

describe("sortByCloseness", () => {
  it("orders by closeness to the target, closest first", () => {
    const rows = [{ usd_value: 4.99 }, { usd_value: 30 }, { usd_value: 15 }];
    expect(sortByCloseness(rows, 1500).map((r) => r.usd_value)).toEqual([15, 4.99, 30]);
    expect(sortByCloseness(rows, 3000).map((r) => r.usd_value)).toEqual([30, 15, 4.99]);
  });

  it("is stable for ties", () => {
    const rows = [
      { id: "a", usd_value: 10 },
      { id: "b", usd_value: 20 },
      { id: "c", usd_value: 10 },
    ];
    expect(sortByCloseness(rows, 1500).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("puts non-finite values last", () => {
    const rows = [{ usd_value: NaN }, { usd_value: 100 }, { usd_value: Infinity }, { usd_value: 5 }];
    const sorted = sortByCloseness(rows, 500);
    expect(sorted.slice(0, 2).map((r) => r.usd_value)).toEqual([5, 100]);
    expect(sorted.slice(2).every((r) => !Number.isFinite(r.usd_value))).toBe(true);
  });

  it("returns a new array and does not mutate the input", () => {
    const rows = [{ usd_value: 30 }, { usd_value: 15 }];
    const copy = [...rows];
    const sorted = sortByCloseness(rows, 1500);
    expect(sorted).not.toBe(rows);
    expect(rows).toEqual(copy);
  });
});
