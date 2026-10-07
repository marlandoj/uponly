// MOCK DoorDash agent-ordering provider. Makes NO network call and places no
// order — it fabricates a confirmation shaped like a delivery API response.
//
// What the real call would look like (DoorDash Drive "create delivery"):
//   POST https://openapi.doordash.com/drive/v2/deliveries
//   { "external_delivery_id": "<earning id>", "order_value": 1000,
//     "pickup_address": "...", "dropoff_address": "<household address>",
//     "items": [{ "name": "<reward name>", "quantity": 1 }] }
//   → 200 { "external_delivery_id": "...", "delivery_status": "created",
//           "dropoff_time_estimated": "2026-10-07T18:40:00Z", ... }
// Here the order id is MOCK-DD-XXXXXX and the ETA is 25-40 minutes.

import {
  cryptoRandomBytes,
  toHex,
  type EarningInfo,
  type FulfillmentProvider,
  type FulfillmentResult,
  type RandomBytes,
  type RewardInfo,
} from "./types";

export const MOCK_ORDER_ID = /^MOCK-DD-[0-9A-F]{6}$/;
export const MOCK_ETA_MIN = 25;
export const MOCK_ETA_MAX = 40;

export function mockOrderId(random: RandomBytes = cryptoRandomBytes): string {
  return `MOCK-DD-${toHex(random(3))}`;
}

/**
 * ETA in [25, 40] minutes, derived from the order id so a page reload shows
 * the same ETA without storing it (only the ref is persisted).
 */
export function mockEtaMinutes(orderId: string): number {
  let h = 0;
  for (const ch of orderId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MOCK_ETA_MIN + (h % (MOCK_ETA_MAX - MOCK_ETA_MIN + 1));
}

export function createMockDoorDash(random: RandomBytes = cryptoRandomBytes): FulfillmentProvider {
  return {
    async fulfill(reward: RewardInfo, earning: EarningInfo): Promise<FulfillmentResult> {
      const request = {
        external_delivery_id: earning.id,
        order_value: reward.valueCents ?? 0,
        items: [{ name: reward.name, quantity: 1 }],
      };
      console.log("[MOCK doordash] POST /drive/v2/deliveries (not sent — mock)", JSON.stringify(request));
      const orderId = mockOrderId(random);
      const etaMinutes = mockEtaMinutes(orderId);
      console.log(`[MOCK doordash] 200 created ${orderId}, ETA ${etaMinutes} min (fake, nothing ordered)`);
      return { ref: orderId, etaMinutes, displayText: "Order confirmed" };
    },
  };
}

export const mockDoorDash = createMockDoorDash();
