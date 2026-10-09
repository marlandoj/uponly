import { describe, expect, it } from "vitest";
import { levelLabel, playerName } from "./playerName";

describe("playerName", () => {
  it("prefers the gamer tag", () => {
    expect(playerName({ display_name: "Player", gamer_tag: "NinjaKid42" })).toBe("NinjaKid42");
  });

  it("falls back to the display name when no tag is set", () => {
    for (const gamer_tag of [null, undefined, "", "   "]) {
      expect(playerName({ display_name: "Player", gamer_tag })).toBe("Player");
    }
  });
});

describe("levelLabel", () => {
  it("labels the level with two decimals", () => {
    expect(levelLabel(3.5)).toBe("Lv 3.50");
    expect(levelLabel("4.125")).toBe("Lv 4.13");
  });

  it("defaults a missing level to the starting 3.50", () => {
    expect(levelLabel(null)).toBe("Lv 3.50");
  });
});
