import { describe, expect, it } from "vitest";
import { QUESTS } from "./quests";
import { resolveSprite, SPRITES } from "./sprite";

describe("resolveSprite", () => {
  it("maps reward names by keyword, case-insensitively", () => {
    expect(resolveSprite("reward", "Friday Burrito")).toBe(SPRITES["reward-burrito"]);
    expect(resolveSprite("reward", "PIZZA night")).toBe(SPRITES["reward-pizza"]);
    expect(resolveSprite("reward", "Double cheeseburger")).toBe(SPRITES["reward-burger"]);
    expect(resolveSprite("reward", "Hot fudge sundae")).toBe(SPRITES["reward-sundae"]);
    expect(resolveSprite("reward", "Ice Cream run")).toBe(SPRITES["reward-sundae"]);
  });

  it("maps quest titles by keyword", () => {
    expect(resolveSprite("chore", "Dish Dragon")).toBe(SPRITES["chore-dishes"]);
    expect(resolveSprite("chore", "Laundry Fold")).toBe(SPRITES["chore-laundry"]);
    expect(resolveSprite("chore", "Trash Run")).toBe(SPRITES["chore-trash"]);
    expect(resolveSprite("chore", "Vacuum the hall")).toBe(SPRITES["chore-vacuum"]);
    expect(resolveSprite("chore", "Make the bed")).toBe(SPRITES["chore-bedroom"]);
  });

  it("prefers laundry over bed for bed linens", () => {
    expect(resolveSprite("chore", "Laundry: bed linens")).toBe(SPRITES["chore-laundry"]);
  });

  it("covers the catalog quests that have art and skips the rest", () => {
    const byKey = Object.fromEntries(QUESTS.map((q) => [q.key, resolveSprite("chore", q.title)]));
    expect(byKey).toEqual({
      dishes: SPRITES["chore-dishes"],
      laundry: SPRITES["chore-laundry"],
      floor: SPRITES["chore-vacuum"],
      surfaces: null,
      tidy: SPRITES["chore-bedroom"],
      trash: SPRITES["chore-trash"],
      bathroom: null,
    });
  });

  it("keeps kinds separate", () => {
    expect(resolveSprite("chore", "Pizza")).toBeNull();
    expect(resolveSprite("reward", "Dish duty")).toBeNull();
  });

  it("returns null for no match or empty input", () => {
    expect(resolveSprite("reward", "$10 gift card")).toBeNull();
    expect(resolveSprite("reward", "")).toBeNull();
    expect(resolveSprite("chore", null)).toBeNull();
    expect(resolveSprite("chore", undefined)).toBeNull();
  });
});
