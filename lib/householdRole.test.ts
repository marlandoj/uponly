import { describe, expect, it } from "vitest";
import { isHouseholdRole, parseHouseholdRole } from "./householdRole";

describe("parseHouseholdRole", () => {
  it("accepts gamemaster and gamer", () => {
    expect(parseHouseholdRole("gamemaster", "gamer")).toBe("gamemaster");
    expect(parseHouseholdRole("gamer", "gamemaster")).toBe("gamer");
  });

  it("falls back on garbage, empty or missing values", () => {
    for (const v of ["", " ", "GameMaster", "GAMER", "parent", "kid", "owner", "admin", null, undefined, 1, {}, ["gamer"]]) {
      expect(parseHouseholdRole(v, "gamemaster")).toBe("gamemaster");
      expect(parseHouseholdRole(v, "gamer")).toBe("gamer");
    }
  });

  it("isHouseholdRole matches the DB check", () => {
    expect(isHouseholdRole("gamemaster")).toBe(true);
    expect(isHouseholdRole("gamer")).toBe(true);
    expect(isHouseholdRole("member")).toBe(false);
  });
});
