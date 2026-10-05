import { describe, expect, it } from "vitest";
import { JOIN_CODE_ALPHABET, normalizeJoinCode } from "./joinCode";

describe("normalizeJoinCode", () => {
  it("accepts a valid code regardless of case, spaces and dashes", () => {
    expect(normalizeJoinCode("hk7-m2q")).toBe("HK7M2Q");
    expect(normalizeJoinCode(" hk7 m2q ")).toBe("HK7M2Q");
    expect(normalizeJoinCode("HK7M2Q")).toBe("HK7M2Q");
  });

  it("rejects ambiguous characters", () => {
    for (const bad of ["0", "O", "1", "I", "L"]) {
      expect(normalizeJoinCode(`HK7M2${bad}`)).toBeNull();
    }
  });

  it("rejects wrong lengths", () => {
    expect(normalizeJoinCode("")).toBeNull();
    expect(normalizeJoinCode("HK7M2")).toBeNull();
    expect(normalizeJoinCode("HK7M2QQ")).toBeNull();
  });

  it("alphabet agrees with the validator", () => {
    for (const ch of JOIN_CODE_ALPHABET) {
      expect(normalizeJoinCode(ch.repeat(6))).toBe(ch.repeat(6));
    }
    expect(JOIN_CODE_ALPHABET).toHaveLength(31);
  });
});
