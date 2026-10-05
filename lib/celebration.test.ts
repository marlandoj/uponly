import { describe, expect, it } from "vitest";
import { isEvidencePathFor, normalizeRatingCode, ratingPath } from "./celebration";

const P = "11111111-1111-1111-1111-111111111111";
const R = "22222222-2222-2222-2222-222222222222";

describe("isEvidencePathFor", () => {
  it("accepts only this run's before/after keys", () => {
    expect(isEvidencePathFor(`${P}/${R}/before.jpg`, P, R)).toBe(true);
    expect(isEvidencePathFor(`${P}/${R}/after.jpg`, P, R)).toBe(true);
  });

  it("refuses other players, other runs, odd names and null", () => {
    expect(isEvidencePathFor(`${R}/${R}/after.jpg`, P, R)).toBe(false);
    expect(isEvidencePathFor(`${P}/${P}/after.jpg`, P, R)).toBe(false);
    expect(isEvidencePathFor(`${P}/${R}/../x.jpg`, P, R)).toBe(false);
    expect(isEvidencePathFor(null, P, R)).toBe(false);
  });
});

describe("rating codes", () => {
  it("normalize like circle codes and build the rating path", () => {
    expect(normalizeRatingCode(" qm4-x7p ")).toBe("QM4X7P");
    expect(normalizeRatingCode("QM4X7O")).toBeNull();
    expect(ratingPath("QM4X7P")).toBe("/r/QM4X7P");
  });
});
