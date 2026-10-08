import type { FulfillmentKind } from "@/lib/fulfillment";
import type { Game } from "@/lib/rewards";

// One-tap game credit rewards ("chores → game loot"). A template is just a
// prefilled create_reward call: kind 'game_credit', fulfilled as a (mock)
// gift card the parent hands over. Nothing here buys anything in a game —
// there is no Epic / Roblox / Microsoft purchasing API, and we don't pretend.

export type GameCreditTemplate = {
  id: string;
  game: Game;
  /** "1,000 V-Bucks"; also the reward name. */
  label: string;
  /** Suggested gift-card value covering the pack (USD list price). null = parent sets it. */
  valueCents: number | null;
  fulfillment: Extract<FulfillmentKind, "mock-tremendous">;
};

export type GameRewardInput = {
  name: string;
  description: string;
  valueCents: number | null;
  fulfillment: FulfillmentKind;
  kind: "game_credit";
  game: Game;
};

const pack = (id: string, game: Game, amount: number, currency: string, valueCents: number): GameCreditTemplate => ({
  id,
  game,
  label: `${amount.toLocaleString("en-US")} ${currency}`,
  valueCents,
  fulfillment: "mock-tremendous",
});

export const CUSTOM_TEMPLATE_ID = "custom";

export const GAME_CREDIT_TEMPLATES: GameCreditTemplate[] = [
  pack("vbucks-1000", "Fortnite", 1000, "V-Bucks", 899),
  pack("vbucks-2800", "Fortnite", 2800, "V-Bucks", 2299),
  pack("vbucks-5000", "Fortnite", 5000, "V-Bucks", 3699),
  pack("robux-400", "Roblox", 400, "Robux", 499),
  pack("robux-800", "Roblox", 800, "Robux", 999),
  pack("robux-1700", "Roblox", 1700, "Robux", 1999),
  pack("minecoins-3500", "Minecraft", 3500, "Minecoins", 1999),
  { id: CUSTOM_TEMPLATE_ID, game: "Other", label: "Custom amount", valueCents: null, fulfillment: "mock-tremendous" },
];

/** Overrides for the custom template (or a parent tweaking a pack). */
export type TemplateOverrides = Partial<Pick<GameRewardInput, "name" | "valueCents" | "game">>;

export function templateToRewardInput(t: GameCreditTemplate, over: TemplateOverrides = {}): GameRewardInput {
  const game = over.game ?? t.game;
  return {
    name: over.name ?? t.label,
    description: game === "Other" ? "Game credit gift card" : `${game} game credit gift card`,
    valueCents: over.valueCents !== undefined ? over.valueCents : t.valueCents,
    fulfillment: t.fulfillment,
    kind: "game_credit",
    game,
  };
}

/** Value stays a dollar string on the form (parseRewardForm converts back). */
export const centsToDollarInput = (cents: number | null) => (cents == null ? "" : (cents / 100).toFixed(2));

// 1,000 V-Bucks list at $8.99; shop items get a gift-card value at that rate,
// rounded up to whole cents so the card always covers the item.
const VBUCKS_CENTS_PER_1000 = 899;

export const vbucksToCents = (vbucks: number) => Math.ceil((vbucks * VBUCKS_CENTS_PER_1000) / 1000);

/** A Fortnite shop item as a game credit reward (display + link only; never bought). */
export function shopItemToRewardInput(item: { name: string; vbucks: number }): GameRewardInput {
  return {
    name: item.name.trim().slice(0, 60),
    description: "Fortnite shop drop",
    valueCents: vbucksToCents(item.vbucks),
    fulfillment: "mock-tremendous",
    kind: "game_credit",
    game: "Fortnite",
  };
}
