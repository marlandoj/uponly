import { EVIDENCE_EXTS, evidencePath } from "@/lib/evidence";
import { normalizeJoinCode } from "@/lib/joinCode";
import type { Rating } from "@/lib/rating";

// Celebration codes use the circle join-code alphabet (no 0/O/1/I/L).
export const normalizeRatingCode = normalizeJoinCode;

/** Lifetime of a signed evidence-photo URL handed to a circle-mate. */
export const PHOTO_URL_TTL_SECONDS = 5 * 60;

export const RATING_LABELS: Record<Rating, { label: string; emoji: string }> = {
  3: { label: "Done", emoji: "👍" },
  4: { label: "Great", emoji: "🌟" },
  5: { label: "Legendary", emoji: "🏆" },
};

export type Eligibility = "self" | "rated" | "new_member" | "ok";

/** One row of the get_celebration RPC (0004_celebrations.sql). */
export type Celebration = {
  run_id: string;
  title: string;
  finish_condition: string;
  verification: string | null;
  verification_reason: string | null;
  completed_at: string;
  player_id: string;
  player_name: string;
  player_level: number;
  before_path: string | null;
  after_path: string | null;
  eligibility: Eligibility;
  can_rate_from: string;
  my_rating: Rating | null;
  my_counted: boolean | null;
  my_not_counted: NotCountedReason | null;
  my_xp_awarded: number | null;
  my_level_before: number | null;
  my_level_after: number | null;
  my_xp_after: number | null;
  my_first_fold: boolean | null;
};

export type NotCountedReason = "completion_not_credited" | "completion_rating_cap" | "rater_daily_cap";

/** Positive wording for a rating that was recorded but didn't change the level. */
export const NOT_COUNTED_MESSAGES: Record<NotCountedReason, string> = {
  completion_not_credited: "This one was a bonus quest past today's limit, so it's just for fun.",
  completion_rating_cap: "This quest already got its two celebrations — your cheer still counts in spirit!",
  rater_daily_cap: "You've handed out today's five celebrations. Thanks for being generous!",
};

export const ratingPath = (code: string) => `/r/${code}`;

/**
 * True only for this run's own evidence keys ("<player>/<run>/{before,after}.{jpg,mp4,webm}").
 * Defence in depth before signing with the service-role client.
 */
export function isEvidencePathFor(path: string | null, playerId: string, runId: string): path is string {
  return EVIDENCE_EXTS.some(
    (ext) => path === evidencePath(playerId, runId, "before", ext) || path === evidencePath(playerId, runId, "after", ext),
  );
}
