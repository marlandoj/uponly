import { describe, expect, it } from "vitest";
import { parseGamerProfileForm, PROFILE_GAMES } from "./gamerProfile";

describe("gamer profile form", () => {
  it("offers Fortnite, Roblox and Minecraft", () => {
    expect(PROFILE_GAMES).toEqual(["Fortnite", "Roblox", "Minecraft"]);
  });
  it("trims the tag and de-duplicates games", () => {
    expect(parseGamerProfileForm({ gamerTag: "  NinjaKid42 ", games: ["Roblox", "Fortnite", "Roblox"] })).toEqual({
      ok: true,
      value: { gamerTag: "NinjaKid42", games: ["Fortnite", "Roblox"] },
    });
  });
  it("clears an empty tag", () => {
    expect(parseGamerProfileForm({ gamerTag: "   " })).toEqual({ ok: true, value: { gamerTag: null, games: [] } });
  });
  it("rejects long tags and unknown games", () => {
    expect(parseGamerProfileForm({ gamerTag: "x".repeat(33) }).ok).toBe(false);
    expect(parseGamerProfileForm({ gamerTag: "x".repeat(32) }).ok).toBe(true);
    expect(parseGamerProfileForm({ gamerTag: "x", games: ["Halo"] }).ok).toBe(false);
  });
});
