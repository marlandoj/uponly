// Household roles (0012_household_roles.sql): parents approve finishes and
// control loot; kids do chores and earn. The RPCs enforce it; the UI reflects it.

export const HOUSEHOLD_ROLES = ["parent", "kid"] as const;
export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number];

export function isHouseholdRole(value: unknown): value is HouseholdRole {
  return typeof value === "string" && (HOUSEHOLD_ROLES as readonly string[]).includes(value);
}

/** A form value as a household role, or `fallback` when missing or unrecognized. */
export function parseHouseholdRole(value: unknown, fallback: HouseholdRole): HouseholdRole {
  return isHouseholdRole(value) ? value : fallback;
}
