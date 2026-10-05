import { describe, expect, it } from "vitest";
import { deriveRecipientAddress, getMintBackend, mintLabel } from "./mint";

describe("getMintBackend", () => {
  it("defaults to simulated", () => {
    expect(getMintBackend({} )).toBe("simulated");
  });
  it("stays simulated on any other value", () => {
    expect(getMintBackend({ MINT_BACKEND: "mainnet" } )).toBe("simulated");
  });
  it("goes onchain only on the literal flag", () => {
    expect(getMintBackend({ MINT_BACKEND: "onchain" } )).toBe("onchain");
  });
});

describe("deriveRecipientAddress", () => {
  it("is deterministic", () => {
    expect(deriveRecipientAddress("abc")).toBe(deriveRecipientAddress("abc"));
  });
  it("differs per user", () => {
    expect(deriveRecipientAddress("abc")).not.toBe(deriveRecipientAddress("def"));
  });
  it("looks like an address", () => {
    expect(deriveRecipientAddress("abc")).toMatch(/^0x[0-9a-f]{40}$/);
  });
});

describe("mintLabel", () => {
  it("labels simulated mints", () => {
    expect(mintLabel({ backend: "simulated", tx_hash: null })).toBe("simulated");
  });
  it("shows the tx hash onchain", () => {
    expect(mintLabel({ backend: "onchain", tx_hash: "0x123" })).toBe("0x123");
  });
});
