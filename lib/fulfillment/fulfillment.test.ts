import { describe, expect, it, vi } from "vitest";
import {
  getProvider,
  isFulfillmentKind,
  ManualFulfillmentError,
  PROVIDERS,
  type EarningInfo,
  type RewardInfo,
} from ".";
import { manualProvider } from "./manual";
import {
  createMockDoorDash,
  MOCK_ETA_MAX,
  MOCK_ETA_MIN,
  MOCK_ORDER_ID,
  mockEtaMinutes,
  mockOrderId,
} from "./mock-doordash";
import { createMockTremendous, MOCK_GIFT_CODE, mockGiftCode } from "./mock-tremendous";

const reward: RewardInfo = { id: "r1", name: "Pizza night", description: "", valueCents: 1500, fulfillment: "mock-doordash" };
const earning: EarningInfo = { id: "e1", profileId: "p1", questRunId: "q1" };
const fixed = (byte: number) => (n: number) => new Uint8Array(n).fill(byte);

vi.spyOn(console, "log").mockImplementation(() => {});

describe("mock Tremendous", () => {
  it("formats a DD-XXXX-XXXX hex gift code", () => {
    expect(mockGiftCode(fixed(0xab))).toBe("DD-ABAB-ABAB");
    for (let i = 0; i < 50; i++) expect(mockGiftCode()).toMatch(MOCK_GIFT_CODE);
  });
  it("returns the code as ref and labels it mock", async () => {
    const res = await createMockTremendous(fixed(0x1f)).fulfill({ ...reward, fulfillment: "mock-tremendous" }, earning);
    expect(res).toEqual({ ref: "DD-1F1F-1F1F", displayText: "Gift code DD-1F1F-1F1F (mock)" });
    expect(res.etaMinutes).toBeUndefined();
  });
});

describe("mock DoorDash", () => {
  it("formats a MOCK-DD-XXXXXX order id", () => {
    expect(mockOrderId(fixed(0x0c))).toBe("MOCK-DD-0C0C0C");
    for (let i = 0; i < 50; i++) expect(mockOrderId()).toMatch(MOCK_ORDER_ID);
  });
  it("keeps the ETA in 25-40 and stable per order id", () => {
    for (let i = 0; i < 200; i++) {
      const id = mockOrderId();
      const eta = mockEtaMinutes(id);
      expect(eta).toBeGreaterThanOrEqual(MOCK_ETA_MIN);
      expect(eta).toBeLessThanOrEqual(MOCK_ETA_MAX);
      expect(mockEtaMinutes(id)).toBe(eta);
    }
  });
  it("confirms the order with id + ETA", async () => {
    const res = await createMockDoorDash().fulfill(reward, earning);
    expect(res.ref).toMatch(MOCK_ORDER_ID);
    expect(res.etaMinutes).toBe(mockEtaMinutes(res.ref));
    expect(res.displayText).toBe("Order confirmed");
  });
});

describe("manual + registry", () => {
  it("manual provider never auto-fulfills", async () => {
    await expect(manualProvider.fulfill({ ...reward, fulfillment: "manual" }, earning)).rejects.toBeInstanceOf(
      ManualFulfillmentError,
    );
  });
  it("maps mock kinds to providers and manual to null", () => {
    expect(getProvider("mock-tremendous")).toBe(PROVIDERS["mock-tremendous"]);
    expect(getProvider("mock-doordash")).toBe(PROVIDERS["mock-doordash"]);
    expect(getProvider("manual")).toBeNull();
  });
  it("lets a replacement provider be swapped in", () => {
    const real = { fulfill: async () => ({ ref: "REAL-1", displayText: "ok" }) };
    expect(getProvider("mock-doordash", { ...PROVIDERS, "mock-doordash": real })).toBe(real);
  });
  it("recognises only known kinds", () => {
    expect(isFulfillmentKind("manual")).toBe(true);
    expect(isFulfillmentKind("tremendous")).toBe(false);
    expect(isFulfillmentKind(null)).toBe(false);
  });
});
