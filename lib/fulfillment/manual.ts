// Manual fulfillment: a parent hands over the reward in real life and marks
// it fulfilled from /rewards/queue. Nothing is ever auto-fulfilled.

import type { EarningInfo, FulfillmentProvider, FulfillmentResult, RewardInfo } from "./types";

/** fulfillment_ref recorded when a parent marks a reward fulfilled. */
export const MANUAL_FULFILLMENT_REF = "manual-parent";

export class ManualFulfillmentError extends Error {
  constructor(rewardName: string) {
    super(`"${rewardName}" is fulfilled by a parent, not automatically`);
    this.name = "ManualFulfillmentError";
  }
}

/** Not in the auto registry; exists so a stray call fails loudly. */
export const manualProvider: FulfillmentProvider = {
  async fulfill(reward: RewardInfo, _earning: EarningInfo): Promise<FulfillmentResult> {
    throw new ManualFulfillmentError(reward.name);
  },
};
