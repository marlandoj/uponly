// MOCK Tremendous gift-card provider. Makes NO network call and charges
// nothing — it fabricates a response shaped like the real API so the rest of
// the app can be built against it.
//
// What the real call would look like (Tremendous "create order"):
//   POST https://testflight.tremendous.com/api/v2/orders
//   {
//     "payment": { "funding_source_id": "<FUNDING_SOURCE>" },
//     "reward": {
//       "value": { "denomination": 10.00, "currency_code": "USD" },
//       "delivery": { "method": "LINK" },
//       "recipient": { "name": "<gamer display name>" },
//       "products": ["<DOORDASH_GIFT_CARD_PRODUCT_ID>"]
//     }
//   }
//   → 200 { "order": { "id": "...", "status": "EXECUTED",
//            "rewards": [{ "id": "...", "delivery": { "status": "SUCCEEDED" } }] } }
// Here the "gift code" is random hex: DD-XXXX-XXXX.

import {
  cryptoRandomBytes,
  toHex,
  type EarningInfo,
  type FulfillmentProvider,
  type FulfillmentResult,
  type RandomBytes,
  type RewardInfo,
} from "./types";

export const MOCK_GIFT_CODE = /^DD-[0-9A-F]{4}-[0-9A-F]{4}$/;

export function mockGiftCode(random: RandomBytes = cryptoRandomBytes): string {
  const hex = toHex(random(4));
  return `DD-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export function createMockTremendous(random: RandomBytes = cryptoRandomBytes): FulfillmentProvider {
  return {
    async fulfill(reward: RewardInfo, earning: EarningInfo): Promise<FulfillmentResult> {
      const request = {
        reward: {
          value: { denomination: (reward.valueCents ?? 0) / 100, currency_code: "USD" },
          delivery: { method: "LINK" },
          products: ["MOCK_DOORDASH_GIFT_CARD"],
        },
        external_id: earning.id,
      };
      console.log("[MOCK tremendous] POST /api/v2/orders (not sent — mock)", JSON.stringify(request));
      const code = mockGiftCode(random);
      console.log(`[MOCK tremendous] 200 order EXECUTED, gift code ${code} (fake, not redeemable)`);
      return { ref: code, displayText: `Gift code ${code} (mock)` };
    },
  };
}

export const mockTremendous = createMockTremendous();
