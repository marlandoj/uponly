import { describe, expect, it } from "vitest";
import { LOOT_SPRITES, resolveLootSprite } from "./lootSprites";

const loot = (game: string | null, name: string) => resolveLootSprite({ kind: "game_credit", game, name });

describe("resolveLootSprite", () => {
  it("returns null for food", () => {
    expect(resolveLootSprite({ kind: "food", game: null, name: "1,000 V-Bucks pizza" })).toBeNull();
  });
  it("matches currency names first", () => {
    expect(loot("Fortnite", "1,000 V-Bucks")).toBe(LOOT_SPRITES.coin);
    expect(loot("Other", "800 Robux")).toBe(LOOT_SPRITES.gem);
    expect(loot("Minecraft", "3,500 Minecoins")).toBe(LOOT_SPRITES.coin);
    expect(loot("Roblox", "Roblox gift card")).toBe(LOOT_SPRITES.giftcard);
  });
  it("falls back to the game, then a gift card", () => {
    expect(loot("Fortnite", "Skull Trooper Bundle")).toBe(LOOT_SPRITES.coin);
    expect(loot("Roblox", "Weekend bonus")).toBe(LOOT_SPRITES.gem);
    expect(loot("Minecraft", "Skin pack")).toBe(LOOT_SPRITES.coin);
    expect(loot("Other", "Custom amount")).toBe(LOOT_SPRITES.giftcard);
    expect(resolveLootSprite({ kind: "game_credit" })).toBe(LOOT_SPRITES.giftcard);
  });
  it("points at files under /img", () => {
    for (const p of Object.values(LOOT_SPRITES)) expect(p).toMatch(/^\/img\/loot-[a-z]+\.webp$/);
  });
});
