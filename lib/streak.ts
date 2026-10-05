// Daily streak rule. The database (0005_streaks.sql, inside complete_quest)
// is the authority — this mirrors it exactly so the rule stays unit-tested.
// Keep the two in sync: consecutive UTC days with a completed quest.

/** Next streak given the current streak and last quest date (YYYY-MM-DD). */
export function nextStreak(current: number, lastDate: string | null, today: string): number {
  if (lastDate === today) return current; // already counted today
  if (lastDate === yesterdayOf(today)) return current + 1; // streak continues
  return 1; // new streak (or broken)
}

/** The calendar day before a YYYY-MM-DD date (UTC). */
export function yesterdayOf(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) - 86_400_000);
  return dt.toISOString().slice(0, 10);
}
