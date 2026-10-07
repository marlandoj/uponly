import { describe, expect, it, vi } from "vitest";
import { PROVIDERS, type FulfillmentProvider } from "@/lib/fulfillment";
import { MOCK_ORDER_ID } from "@/lib/fulfillment/mock-doordash";
import { MOCK_GIFT_CODE } from "@/lib/fulfillment/mock-tremendous";
import { QUESTS } from "@/lib/quests";
import {
  describeEarning,
  dollarsToCents,
  earnRewardsForRun,
  eligibleRewards,
  fulfillEarning,
  isAutoFulfilled,
  isRewardForQuest,
  parseRewardForm,
  questLabel,
  type Reward,
  type RewardEarning,
  type RewardStore,
} from "./rewards";

vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});

const CIRCLE = "c1";
const run = { id: "run1", user_id: "kid", circle_id: CIRCLE, quest_key: "dishes" };

const reward = (over: Partial<Reward>): Reward => ({
  id: "r",
  circle_id: CIRCLE,
  name: "Treat",
  description: "",
  value_cents: 1000,
  fulfillment: "manual",
  quest_key: null,
  ...over,
});

/** In-memory RewardStore with the RPCs' semantics (idempotent earn, earned→fulfilled). */
function fakeStore(rewards: Reward[]) {
  const earnings = new Map<string, RewardEarning>();
  const calls: string[] = [];
  const store: RewardStore = {
    async listCircleRewards(circleId) {
      return rewards.filter((r) => r.circle_id === circleId);
    },
    async recordEarning(rewardId, runId) {
      calls.push(`record:${rewardId}`);
      const key = `${rewardId}:${runId}`;
      const existing = earnings.get(key);
      if (existing) return existing;
      const e: RewardEarning = {
        id: `e-${rewardId}`,
        reward_id: rewardId,
        profile_id: run.user_id,
        quest_run_id: runId,
        status: "earned",
        earned_at: "2026-10-07T00:00:00Z",
        fulfilled_at: null,
        fulfillment_ref: null,
      };
      earnings.set(key, e);
      return e;
    },
    async markFulfilled(earningId, ref) {
      calls.push(`fulfill:${earningId}`);
      for (const [k, e] of earnings) {
        if (e.id === earningId) {
          const next = fulfillEarning(e, ref);
          earnings.set(k, next);
          return next;
        }
      }
      throw new Error("no earning");
    },
  };
  return { store, earnings, calls };
}

describe("quest → reward mapping", () => {
  it("matches catalog quest keys exactly; null means any quest", () => {
    expect(isRewardForQuest({ quest_key: "dishes" }, "dishes")).toBe(true);
    expect(isRewardForQuest({ quest_key: "laundry" }, "dishes")).toBe(false);
    expect(isRewardForQuest({ quest_key: null }, "dishes")).toBe(true);
  });
  it("every catalog key is a valid reward quest_key", () => {
    for (const q of QUESTS) expect(q.key).toMatch(/^[a-z0-9-]{1,40}$/);
  });
  it("filters to the run's circle and quest", () => {
    const rs = [
      reward({ id: "a", quest_key: "dishes" }),
      reward({ id: "b", quest_key: "laundry" }),
      reward({ id: "c", quest_key: null }),
      reward({ id: "d", quest_key: "dishes", circle_id: "other" }),
    ];
    expect(eligibleRewards(rs, run).map((r) => r.id)).toEqual(["a", "c"]);
  });
  it("labels quests from the catalog", () => {
    expect(questLabel(null)).toBe("Any quest");
    expect(questLabel("dishes")).toBe("🍽️ Dish Dragon");
  });
});

describe("earning status transitions", () => {
  const earned = { status: "earned" as const, fulfilled_at: null, fulfillment_ref: null };
  it("earned → fulfilled sets time and ref", () => {
    const now = new Date("2026-10-07T12:00:00Z");
    expect(fulfillEarning(earned, " manual-parent ", now)).toEqual({
      status: "fulfilled",
      fulfilled_at: "2026-10-07T12:00:00.000Z",
      fulfillment_ref: "manual-parent",
    });
  });
  it("requires a ref", () => {
    expect(() => fulfillEarning(earned, "  ")).toThrow();
  });
  it("fulfilled is terminal (idempotent)", () => {
    const done = { status: "fulfilled" as const, fulfilled_at: "x", fulfillment_ref: "DD-1" };
    expect(fulfillEarning(done, "other")).toBe(done);
  });
  it("only mock providers auto-fulfill", () => {
    expect(isAutoFulfilled("mock-tremendous")).toBe(true);
    expect(isAutoFulfilled("mock-doordash")).toBe(true);
    expect(isAutoFulfilled("manual")).toBe(false);
  });
  it("describes each state for the kid", () => {
    expect(describeEarning("manual", "earned", null).displayText).toBe("Your parent will fulfill this");
    expect(describeEarning("mock-tremendous", "fulfilled", "DD-AAAA-BBBB").displayText).toContain("DD-AAAA-BBBB");
    const dd = describeEarning("mock-doordash", "fulfilled", "MOCK-DD-ABCDEF");
    expect(dd.displayText).toBe("Order confirmed");
    expect(dd.etaMinutes).toBeGreaterThanOrEqual(25);
    expect(dd.etaMinutes).toBeLessThanOrEqual(40);
  });
});

describe("earnRewardsForRun", () => {
  it("earns every eligible reward and auto-fulfills mocks", async () => {
    const { store, earnings } = fakeStore([
      reward({ id: "gift", fulfillment: "mock-tremendous", quest_key: "dishes" }),
      reward({ id: "pizza", fulfillment: "mock-doordash" }),
      reward({ id: "cookie", fulfillment: "manual", quest_key: "dishes" }),
      reward({ id: "nope", fulfillment: "manual", quest_key: "laundry" }),
    ]);
    const out = await earnRewardsForRun(store, run);
    expect(out.map((r) => r.rewardId)).toEqual(["gift", "pizza", "cookie"]);

    const [gift, pizza, cookie] = out;
    expect(gift.status).toBe("fulfilled");
    expect(gift.ref).toMatch(MOCK_GIFT_CODE);
    expect(pizza.status).toBe("fulfilled");
    expect(pizza.ref).toMatch(MOCK_ORDER_ID);
    expect(pizza.displayText).toBe("Order confirmed");
    expect(pizza.etaMinutes).toBeGreaterThanOrEqual(25);
    expect(cookie).toMatchObject({ status: "earned", ref: null, displayText: "Your parent will fulfill this" });
    expect(earnings.size).toBe(3);
  });

  it("is idempotent on retry (no second fulfillment)", async () => {
    const { store, calls } = fakeStore([reward({ id: "gift", fulfillment: "mock-tremendous" })]);
    const first = await earnRewardsForRun(store, run);
    const second = await earnRewardsForRun(store, run);
    expect(second[0].ref).toBe(first[0].ref);
    expect(calls.filter((c) => c.startsWith("fulfill:"))).toHaveLength(1);
  });

  it("leaves the earning 'earned' when a provider fails, and keeps going", async () => {
    const broken: FulfillmentProvider = { fulfill: async () => Promise.reject(new Error("provider down")) };
    const { store } = fakeStore([
      reward({ id: "a", fulfillment: "mock-doordash" }),
      reward({ id: "b", fulfillment: "mock-tremendous" }),
    ]);
    const out = await earnRewardsForRun(store, run, { ...PROVIDERS, "mock-doordash": broken });
    expect(out.map((r) => r.status)).toEqual(["earned", "fulfilled"]);
  });

  it("never throws when the store fails", async () => {
    const store: RewardStore = {
      listCircleRewards: async () => Promise.reject(new Error("db down")),
      recordEarning: async () => Promise.reject(new Error("unreachable")),
      markFulfilled: async () => Promise.reject(new Error("unreachable")),
    };
    await expect(earnRewardsForRun(store, run)).resolves.toEqual([]);
  });

  it("skips a reward whose earning can't be recorded", async () => {
    const { store } = fakeStore([reward({ id: "a" }), reward({ id: "b" })]);
    const flaky: RewardStore = {
      ...store,
      recordEarning: (id, runId) => (id === "a" ? Promise.reject(new Error("rls")) : store.recordEarning(id, runId)),
    };
    expect((await earnRewardsForRun(flaky, run)).map((r) => r.rewardId)).toEqual(["b"]);
  });
});

describe("reward form", () => {
  it("converts dollars to cents", () => {
    expect(dollarsToCents("12.5")).toBe(1250);
    expect(dollarsToCents("$7")).toBe(700);
    expect(dollarsToCents("0.05")).toBe(5);
    expect(dollarsToCents("")).toBeNull();
    expect(dollarsToCents("-3")).toBeUndefined();
    expect(dollarsToCents("1.234")).toBeUndefined();
  });
  it("accepts a valid reward attached to a catalog quest", () => {
    expect(
      parseRewardForm({ name: " Pizza ", description: "", value: "15", fulfillment: "mock-doordash", questKey: "dishes" }),
    ).toEqual({
      ok: true,
      value: { name: "Pizza", description: "", valueCents: 1500, fulfillment: "mock-doordash", questKey: "dishes" },
    });
  });
  it("treats an empty quest as any quest", () => {
    const r = parseRewardForm({ name: "Ice cream", fulfillment: "manual", questKey: "" });
    expect(r.ok && r.value.questKey).toBeNull();
  });
  it("rejects unknown quests, kinds, and bad values", () => {
    expect(parseRewardForm({ name: "x", fulfillment: "manual", questKey: "homework" }).ok).toBe(false);
    expect(parseRewardForm({ name: "x", fulfillment: "game-credits" }).ok).toBe(false);
    expect(parseRewardForm({ name: "x", fulfillment: "manual", value: "lots" }).ok).toBe(false);
    expect(parseRewardForm({ name: "", fulfillment: "manual" }).ok).toBe(false);
  });
});
