// Must match the interval in supabase/migrations/0002_quests.sql.
export const MIN_QUEST_SECONDS = 4 * 60;

export type Quest = {
  key: string;
  title: string;
  emoji: string;
  /** The player picks one; it is what the after photo should show. */
  finishConditions: string[];
};

export const QUESTS: Quest[] = [
  {
    key: "dishes",
    title: "Dish Dragon",
    emoji: "🍽️",
    finishConditions: ["Sink is empty", "Dishwasher loaded and running", "Drying rack put away"],
  },
  {
    key: "laundry",
    title: "Laundry Fold",
    emoji: "👕",
    finishConditions: ["Basket folded into stacks", "Clothes put away in drawers", "Bed linens changed"],
  },
  {
    key: "floor",
    title: "Floor Sweep",
    emoji: "🧹",
    finishConditions: ["Floor swept clear", "Floor vacuumed", "Floor mopped"],
  },
  {
    key: "surfaces",
    title: "Counter Crusade",
    emoji: "🧽",
    finishConditions: ["Counters cleared and wiped", "Table cleared and wiped", "Stovetop wiped"],
  },
  {
    key: "tidy",
    title: "Room Reset",
    emoji: "🛋️",
    finishConditions: ["Nothing on the floor", "Desk cleared", "Bed made"],
  },
  {
    key: "trash",
    title: "Trash Run",
    emoji: "🗑️",
    finishConditions: ["Bins emptied with fresh bags", "Recycling sorted and out"],
  },
  {
    key: "bathroom",
    title: "Bathroom Blitz",
    emoji: "🛁",
    finishConditions: ["Sink and mirror wiped", "Toilet cleaned", "Tub or shower scrubbed"],
  },
];

/** Resolves a form submission against the catalog; null if either part is unknown. */
export function resolveQuestChoice(
  questKey: string,
  condition: string,
): { quest: Quest; finishCondition: string } | null {
  const quest = QUESTS.find((q) => q.key === questKey);
  if (!quest || !quest.finishConditions.includes(condition)) return null;
  return { quest, finishCondition: condition };
}

/** Seconds left before the after photo unlocks (never negative). */
export function secondsUntilUnlock(startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil(MIN_QUEST_SECONDS - (nowMs - startedAtMs) / 1000));
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const photoPath = (userId: string, runId: string, kind: "before" | "after") =>
  `${userId}/${runId}/${kind}.jpg`;
