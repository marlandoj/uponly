import { describe, expect, it } from "vitest";
import { isHouseholdRole, parseHouseholdRole } from "./householdRole";

describe("parseHouseholdRole", () => {
  it("accepts parent and kid", () => {
    expect(parseHouseholdRole("parent", "kid")).toBe("parent");
    expect(parseHouseholdRole("kid", "parent")).toBe("kid");
  });

  it("falls back on garbage, empty or missing values", () => {
    for (const v of ["", " ", "Parent", "KID", "owner", "admin", null, undefined, 1, {}, ["kid"]]) {
      expect(parseHouseholdRole(v, "parent")).toBe("parent");
      expect(parseHouseholdRole(v, "kid")).toBe("kid");
    }
  });

  it("isHouseholdRole matches the DB check", () => {
    expect(isHouseholdRole("parent")).toBe(true);
    expect(isHouseholdRole("kid")).toBe(true);
    expect(isHouseholdRole("member")).toBe(false);
  });
});
