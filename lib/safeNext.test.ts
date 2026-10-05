import { describe, expect, it } from "vitest";
import { safeNext } from "./safeNext";

describe("safeNext", () => {
  it("keeps same-origin paths", () => {
    expect(safeNext("/r/QM4X7P")).toBe("/r/QM4X7P");
    expect(safeNext("/quest?x=1")).toBe("/quest?x=1");
  });

  it("rejects anything that could leave the site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "r/abc", "", "/a\nb", null, 5]) {
      expect(safeNext(bad)).toBeNull();
    }
  });
});
