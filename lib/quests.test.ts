import { describe, expect, it } from "vitest";
import { MIN_QUEST_SECONDS, QUESTS, formatClock, resolveQuestChoice, secondsUntilUnlock } from "./quests";

describe("quest catalog", () => {
  it("keys and copy fit the quest_runs column checks", () => {
    const keys = new Set<string>();
    for (const q of QUESTS) {
      expect(q.key).toMatch(/^[a-z0-9-]{1,40}$/);
      expect(keys.has(q.key)).toBe(false);
      keys.add(q.key);
      expect(q.title.length).toBeLessThanOrEqual(80);
      expect(q.finishConditions.length).toBeGreaterThan(0);
      for (const c of q.finishConditions) expect(c.length).toBeLessThanOrEqual(120);
    }
  });

  it("resolveQuestChoice only accepts catalog pairs", () => {
    const [q] = QUESTS;
    expect(resolveQuestChoice(q.key, q.finishConditions[0])?.quest.key).toBe(q.key);
    expect(resolveQuestChoice(q.key, "Something made up")).toBeNull();
    expect(resolveQuestChoice("nope", q.finishConditions[0])).toBeNull();
  });
});

describe("timer", () => {
  it("enforces a 4-minute minimum", () => {
    expect(MIN_QUEST_SECONDS).toBe(240);
    const start = 1_000_000;
    expect(secondsUntilUnlock(start, start)).toBe(240);
    expect(secondsUntilUnlock(start, start + 239_001)).toBe(1);
    expect(secondsUntilUnlock(start, start + 240_000)).toBe(0);
    expect(secondsUntilUnlock(start, start + 999_999)).toBe(0);
  });

  it("formats m:ss", () => {
    expect(formatClock(240)).toBe("4:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(-3)).toBe("0:00");
  });
});
