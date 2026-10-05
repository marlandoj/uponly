// Rating math: chore level, XP and anti-farming caps.
//
// Pure and deterministic — the same ordered event list always produces the same
// totals, so the server can recompute a player's standing from the database and
// the client can preview it without drift. Circle membership and auth are
// enforced by RLS / RPCs, not here.
//
//   Chore level = 3.50 + 1.50 × (1 − e^−S)
//   S           = Σ (rating − 3) × 0.06 × verification
//
// Every term of S is ≥ 0, so the level is monotone: ratings never subtract.

export const BASE_LEVEL = 3.5;
export const LEVEL_RANGE = 1.5;
export const RATING_STEP = 0.06;

export const COMPLETION_XP = 10;
export const CELEBRATION_XP = { 3: 2, 4: 4, 5: 6 } as const;

export const MAX_COUNTED_RATINGS_PER_COMPLETION = 2;
export const MAX_COUNTED_RATINGS_PER_RATER_PER_DAY = 5;
export const MAX_CREDITED_COMPLETIONS_PER_DAY = 3;

/** 3 = Done, 4 = Great, 5 = Legendary. */
export type Rating = keyof typeof CELEBRATION_XP;

/**
 * Outcome of the AI progress check. It never blocks completion; only "pass"
 * earns full weight — unclear, fail and photo-only (no check ran) earn 0.8.
 */
export type Verification = "pass" | "unclear" | "fail" | "photo-only";

export function isRating(n: unknown): n is Rating {
  return n === 3 || n === 4 || n === 5;
}

export function verificationWeight(v: Verification): number {
  return v === "pass" ? 1.0 : 0.8;
}

/** Contribution of one counted rating to S (never negative). */
export function scoreIncrement(rating: Rating, verification: Verification): number {
  return Math.max(0, (rating - 3) * RATING_STEP * verificationWeight(verification));
}

export function levelFromScore(score: number): number {
  return BASE_LEVEL + LEVEL_RANGE * (1 - Math.exp(-Math.max(0, score)));
}

export function formatLevel(level: number): string {
  return level.toFixed(2);
}

/** Calendar day ("YYYY-MM-DD") for cap bookkeeping, shifted by a UTC offset in minutes. */
export function dayKey(atMs: number, tzOffsetMinutes = 0): string {
  return new Date(atMs + tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export type CompletionEvent = {
  kind: "completion";
  completionId: string;
  playerId: string;
  at: number;
  verification: Verification;
};

export type RatingEvent = {
  kind: "rating";
  completionId: string;
  raterId: string;
  rating: Rating;
  at: number;
};

export type LedgerEvent = CompletionEvent | RatingEvent;

export type RejectReason =
  | "duplicate_completion"
  | "daily_completion_cap" // completion recorded, but no XP and not rateable
  | "unknown_completion"
  | "completion_not_credited"
  | "invalid_rating"
  | "self_rating"
  | "already_rated"
  | "completion_rating_cap"
  | "rater_daily_cap";

export type Outcome =
  | { counted: true; playerId: string; xp: number; scoreDelta: number }
  | { counted: false; reason: RejectReason };

export type PlayerStanding = {
  playerId: string;
  xp: number;
  score: number;
  level: number;
  completions: number;
  creditedCompletions: number;
  ratingsReceived: number;
};

type CompletionState = {
  playerId: string;
  verification: Verification;
  credited: boolean;
  raters: Set<string>;
  counted: number;
};

export type Ledger = {
  apply(event: LedgerEvent): Outcome;
  standing(playerId: string): PlayerStanding;
  standings(): PlayerStanding[];
};

/**
 * Stateful accumulator. Events must be applied in chronological order (use
 * `accumulate` to sort). Caps:
 *  - a player's first 3 completions per day are credited (+10 XP each); later
 *    ones are recorded but earn nothing and cannot be rated;
 *  - a credited completion counts at most 2 ratings, one per rater, never the owner's;
 *  - a rater's first 5 counted ratings per day count; extra ratings are ignored.
 * A counted rating adds celebration XP (+2/+4/+6) and its S increment to the completer.
 */
export function createLedger(opts: { tzOffsetMinutes?: number } = {}): Ledger {
  const tz = opts.tzOffsetMinutes ?? 0;
  const players = new Map<string, Omit<PlayerStanding, "level">>();
  const completions = new Map<string, CompletionState>();
  const creditedPerDay = new Map<string, number>(); // `${player}|${day}`
  const ratedPerDay = new Map<string, number>(); // `${rater}|${day}`

  const player = (id: string) => {
    let p = players.get(id);
    if (!p) {
      p = { playerId: id, xp: 0, score: 0, completions: 0, creditedCompletions: 0, ratingsReceived: 0 };
      players.set(id, p);
    }
    return p;
  };

  const withLevel = (p: Omit<PlayerStanding, "level">): PlayerStanding => ({
    ...p,
    level: levelFromScore(p.score),
  });

  function applyCompletion(e: CompletionEvent): Outcome {
    if (completions.has(e.completionId)) return { counted: false, reason: "duplicate_completion" };
    const p = player(e.playerId);
    const key = `${e.playerId}|${dayKey(e.at, tz)}`;
    const today = creditedPerDay.get(key) ?? 0;
    const credited = today < MAX_CREDITED_COMPLETIONS_PER_DAY;
    completions.set(e.completionId, {
      playerId: e.playerId,
      verification: e.verification,
      credited,
      raters: new Set(),
      counted: 0,
    });
    p.completions += 1;
    if (!credited) return { counted: false, reason: "daily_completion_cap" };
    creditedPerDay.set(key, today + 1);
    p.creditedCompletions += 1;
    p.xp += COMPLETION_XP;
    return { counted: true, playerId: e.playerId, xp: COMPLETION_XP, scoreDelta: 0 };
  }

  function applyRating(e: RatingEvent): Outcome {
    if (!isRating(e.rating)) return { counted: false, reason: "invalid_rating" };
    const c = completions.get(e.completionId);
    if (!c) return { counted: false, reason: "unknown_completion" };
    if (e.raterId === c.playerId) return { counted: false, reason: "self_rating" };
    if (!c.credited) return { counted: false, reason: "completion_not_credited" };
    if (c.raters.has(e.raterId)) return { counted: false, reason: "already_rated" };
    if (c.counted >= MAX_COUNTED_RATINGS_PER_COMPLETION) {
      return { counted: false, reason: "completion_rating_cap" };
    }
    const key = `${e.raterId}|${dayKey(e.at, tz)}`;
    const today = ratedPerDay.get(key) ?? 0;
    if (today >= MAX_COUNTED_RATINGS_PER_RATER_PER_DAY) return { counted: false, reason: "rater_daily_cap" };

    ratedPerDay.set(key, today + 1);
    c.raters.add(e.raterId);
    c.counted += 1;
    const xp = CELEBRATION_XP[e.rating];
    const scoreDelta = scoreIncrement(e.rating, c.verification);
    const p = player(c.playerId);
    p.xp += xp;
    p.score += scoreDelta;
    p.ratingsReceived += 1;
    return { counted: true, playerId: c.playerId, xp, scoreDelta };
  }

  return {
    apply: (e) => (e.kind === "completion" ? applyCompletion(e) : applyRating(e)),
    standing: (id) =>
      withLevel(
        players.get(id) ?? {
          playerId: id,
          xp: 0,
          score: 0,
          completions: 0,
          creditedCompletions: 0,
          ratingsReceived: 0,
        },
      ),
    standings: () => [...players.values()].map(withLevel),
  };
}

/**
 * Replays events in chronological order (completions before ratings on ties)
 * and returns the final ledger plus each event's outcome, in sorted order.
 */
export function accumulate(
  events: LedgerEvent[],
  opts: { tzOffsetMinutes?: number } = {},
): { ledger: Ledger; outcomes: { event: LedgerEvent; outcome: Outcome }[] } {
  const sorted = events
    .map((event, i) => ({ event, i }))
    .sort(
      (a, b) =>
        a.event.at - b.event.at ||
        (a.event.kind === b.event.kind ? 0 : a.event.kind === "completion" ? -1 : 1) ||
        a.i - b.i,
    );
  const ledger = createLedger(opts);
  const outcomes = sorted.map(({ event }) => ({ event, outcome: ledger.apply(event) }));
  return { ledger, outcomes };
}
