import { mockDoorDash } from "./mock-doordash";
import { mockTremendous } from "./mock-tremendous";
import { FULFILLMENT_KINDS, type FulfillmentKind, type FulfillmentProvider } from "./types";

export * from "./types";
export { ManualFulfillmentError, MANUAL_FULFILLMENT_REF } from "./manual";

/**
 * Provider per fulfillment kind. `null` = GameMaster fulfills by hand (earning
 * stays 'earned'). To go live, implement FulfillmentProvider against the real
 * API and swap the entry here — callers don't change.
 */
export type ProviderRegistry = Record<Exclude<FulfillmentKind, "manual">, FulfillmentProvider> & {
  manual: null;
};

export const PROVIDERS: ProviderRegistry = {
  "mock-tremendous": mockTremendous,
  "mock-doordash": mockDoorDash,
  manual: null,
};

export function getProvider(
  kind: FulfillmentKind,
  registry: ProviderRegistry = PROVIDERS,
): FulfillmentProvider | null {
  return registry[kind];
}

export function isFulfillmentKind(value: unknown): value is FulfillmentKind {
  return typeof value === "string" && (FULFILLMENT_KINDS as readonly string[]).includes(value);
}

/** Labels for the GameMaster form and queue. */
export const FULFILLMENT_LABELS: Record<FulfillmentKind, string> = {
  "mock-tremendous": "Mock Tremendous gift card",
  "mock-doordash": "Mock DoorDash order",
  manual: "Manual GameMaster fulfillment",
};
