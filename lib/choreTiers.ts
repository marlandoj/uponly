// Chore value tiers (quest_runs.chore_size, 0011). A gamer tags a quest as a
// quick, standard or big chore; the GameMaster's loot picker sorts game loot by how
// close it is to that tier's suggested reward value. Labels only — nothing is
// charged or paid out from these numbers.

/** Must match the quest_runs.chore_size check in 0011_loot_catalog.sql. */
export const CHORE_SIZES = [
  { id: "quick", label: "Quick", emoji: "⚡", suggestedCents: 500 },
  { id: "standard", label: "Standard", emoji: "🎯", suggestedCents: 1500 },
  { id: "big", label: "Big", emoji: "💪", suggestedCents: 3000 },
] as const;

export type ChoreSize = (typeof CHORE_SIZES)[number]["id"];
export type ChoreSizeMeta = (typeof CHORE_SIZES)[number];

export const DEFAULT_CHORE_SIZE: ChoreSize = "standard";

export const isChoreSize = (v: unknown): v is ChoreSize =>
  typeof v === "string" && CHORE_SIZES.some((s) => s.id === v);

/** Form / query value → size; anything invalid or blank is 'standard' (mirrors start_quest). */
export function parseChoreSize(v: unknown): ChoreSize {
  const s = typeof v === "string" ? v.trim() : v;
  return isChoreSize(s) ? s : DEFAULT_CHORE_SIZE;
}

export function choreSizeMeta(size: ChoreSize): ChoreSizeMeta {
  return CHORE_SIZES.find((s) => s.id === size)!;
}

export const suggestedCentsFor = (size: ChoreSize): number => choreSizeMeta(size).suggestedCents;

/**
 * Pure: a new array ordered by |usd_value * 100 - targetCents|, closest first.
 * Stable for ties; non-finite usd_value sorts last.
 */
export function sortByCloseness<T extends { usd_value: number }>(items: T[], targetCents: number): T[] {
  const distance = (item: T) => {
    const usd = Number(item.usd_value);
    return Number.isFinite(usd) ? Math.abs(usd * 100 - targetCents) : Infinity;
  };
  return items
    .map((item, i) => ({ item, i, d: distance(item) }))
    .sort((a, b) => (a.d === b.d ? a.i - b.i : a.d - b.d))
    .map((x) => x.item);
}
