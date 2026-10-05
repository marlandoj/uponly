import { describe, expect, it } from "vitest";
import { BOSSES, BOSS_HP, bossState, bossesDefeatedBetween } from "./boss";

describe("bossState", () => {
  it("starts at full HP against the first boss", () => {
    expect(bossState(0)).toEqual({ defeated: 0, name: BOSSES[0], hp: BOSS_HP, maxHp: BOSS_HP });
  });

  it("loses HP as XP rises and moves on at each multiple of BOSS_HP", () => {
    expect(bossState(10).hp).toBe(BOSS_HP - 10);
    expect(bossState(BOSS_HP)).toMatchObject({ defeated: 1, name: BOSSES[1], hp: BOSS_HP });
    expect(bossState(BOSS_HP * 2 + 6)).toMatchObject({ defeated: 2, hp: BOSS_HP - 6 });
  });

  it("cycles boss names and clamps bad input", () => {
    expect(bossState(BOSS_HP * BOSSES.length).name).toBe(BOSSES[0]);
    expect(bossState(-5)).toMatchObject({ defeated: 0, hp: BOSS_HP });
  });
});

describe("bossesDefeatedBetween", () => {
  it("reports the boss a completion finishes off", () => {
    expect(bossesDefeatedBetween(BOSS_HP - 4, BOSS_HP + 6)).toEqual([BOSSES[0]]);
  });

  it("is empty when no boundary is crossed or XP didn't rise", () => {
    expect(bossesDefeatedBetween(0, 10)).toEqual([]);
    expect(bossesDefeatedBetween(BOSS_HP + 6, BOSS_HP - 4)).toEqual([]);
  });

  it("lists every boss when several fall at once", () => {
    expect(bossesDefeatedBetween(0, BOSS_HP * 2)).toEqual([BOSSES[0], BOSSES[1]]);
  });
});
