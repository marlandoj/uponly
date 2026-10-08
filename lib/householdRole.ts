// Household roles (0012_household_roles.sql, renamed in 0013_gamemaster_rename.sql):
// gamemasters run the game — approve finishes and control loot; gamers play —
// do chores and earn. The RPCs enforce it; the UI reflects it.

export const HOUSEHOLD_ROLES = ["gamemaster", "gamer"] as const;
export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number];

export function isHouseholdRole(value: unknown): value is HouseholdRole {
  return typeof value === "string" && (HOUSEHOLD_ROLES as readonly string[]).includes(value);
}

/** A form value as a household role, or `fallback` when missing or unrecognized. */
export function parseHouseholdRole(value: unknown, fallback: HouseholdRole): HouseholdRole {
  return isHouseholdRole(value) ? value : fallback;
}
