import { describe, expect, it } from "vitest";
import { isFulfillmentKind } from "@/lib/fulfillment";
import { GAMES, parseRewardForm } from "@/lib/rewards";
import {
  centsToDollarInput,
  CUSTOM_TEMPLATE_ID,
  GAME_CREDIT_TEMPLATES,
  shopItemToRewardInput,
  templateToRewardInput,
  vbucksToCents,
} from "./gameRewards";

describe("game credit templates", () => {
  it("seeds V-Bucks, Robux and Minecoins packs plus a custom amount", () => {
    expect(GAME_CREDIT_TEMPLATES.length).toBeGreaterThan(0);
    expect(GAME_CREDIT_TEMPLATES.map((t) => t.label)).toEqual([
      "1,000 V-Bucks",
      "2,800 V-Bucks",
      "5,000 V-Bucks",
      "400 Robux",
      "800 Robux",
      "1,700 Robux",
      "3,500 Minecoins",
      "Custom amount",
    ]);
    expect(new Set(GAME_CREDIT_TEMPLATES.map((t) => t.id)).size).toBe(GAME_CREDIT_TEMPLATES.length);
    for (const t of GAME_CREDIT_TEMPLATES) {
      expect(GAMES).toContain(t.game);
      expect(t.fulfillment).toBe("mock-tremendous");
      expect(t.label.length).toBeLessThanOrEqual(60);
    }
  });

  it("maps a pack to a game_credit reward input", () => {
    const vb = GAME_CREDIT_TEMPLATES.find((t) => t.id === "vbucks-1000")!;
    expect(templateToRewardInput(vb)).toEqual({
      name: "1,000 V-Bucks",
      description: "Fortnite game credit gift card",
      valueCents: 899,
      fulfillment: "mock-tremendous",
      kind: "game_credit",
      game: "Fortnite",
    });
  });

  it("passes custom amounts through", () => {
    const custom = GAME_CREDIT_TEMPLATES.find((t) => t.id === CUSTOM_TEMPLATE_ID)!;
    expect(templateToRewardInput(custom)).toMatchObject({ name: "Custom amount", valueCents: null, game: "Other" });
    expect(templateToRewardInput(custom, { name: "250 Robux", valueCents: 300, game: "Roblox" })).toEqual({
      name: "250 Robux",
      description: "Roblox game credit gift card",
      valueCents: 300,
      fulfillment: "mock-tremendous",
      kind: "game_credit",
      game: "Roblox",
    });
  });

  it("round-trips every template through the reward form", () => {
    for (const t of GAME_CREDIT_TEMPLATES) {
      const r = templateToRewardInput(t);
      expect(isFulfillmentKind(r.fulfillment)).toBe(true);
      const parsed = parseRewardForm({ ...r, value: centsToDollarInput(r.valueCents), questKey: "" });
      expect(parsed).toEqual({ ok: true, value: { ...r, questKey: null } });
    }
  });
});

describe("Fortnite shop items", () => {
  it("prices V-Bucks as a gift card, rounding up", () => {
    expect(vbucksToCents(1000)).toBe(899);
    expect(vbucksToCents(800)).toBe(720); // 719.2 → 720
    expect(vbucksToCents(0)).toBe(0);
  });

  it("maps an item to a Fortnite shop drop", () => {
    expect(shopItemToRewardInput({ name: " Skull Trooper Bundle ", vbucks: 2300 })).toEqual({
      name: "Skull Trooper Bundle",
      description: "Fortnite shop drop",
      valueCents: 2068,
      fulfillment: "mock-tremendous",
      kind: "game_credit",
      game: "Fortnite",
    });
    expect(shopItemToRewardInput({ name: "x".repeat(80), vbucks: 100 }).name).toHaveLength(60);
  });
});
