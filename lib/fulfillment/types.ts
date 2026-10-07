// Fulfillment provider contract. Every provider today is a MOCK (no network,
// no charges); a real Tremendous / DoorDash client drops in by implementing
// FulfillmentProvider and replacing its entry in ./index.ts — callers only
// ever go through getProvider().

/** Must match the rewards.fulfillment check in 0007_rewards.sql. */
export const FULFILLMENT_KINDS = ["mock-tremendous", "mock-doordash", "manual"] as const;
export type FulfillmentKind = (typeof FULFILLMENT_KINDS)[number];

export type RewardInfo = {
  id: string;
  name: string;
  description: string;
  /** null = parent didn't set a value (e.g. a home-cooked treat). */
  valueCents: number | null;
  fulfillment: FulfillmentKind;
};

export type EarningInfo = {
  id: string;
  profileId: string;
  questRunId: string;
};

export type FulfillmentResult = {
  /** Stored as reward_earnings.fulfillment_ref (gift code, order id, …). */
  ref: string;
  etaMinutes?: number;
  /** Short, kid-facing status line. */
  displayText: string;
};

export interface FulfillmentProvider {
  fulfill(reward: RewardInfo, earning: EarningInfo): Promise<FulfillmentResult>;
}

/** Random source, injectable so tests are deterministic. Returns n bytes. */
export type RandomBytes = (n: number) => Uint8Array;

export const cryptoRandomBytes: RandomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

export const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
