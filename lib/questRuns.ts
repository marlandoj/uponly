import type { ApprovalMode, ApprovalStatus } from "@/lib/approval";
import type { Verification } from "@/lib/rating";
import { createClient } from "@/lib/supabase/server";

export type QuestStatus = "draft" | "active" | "completed" | "abandoned";

export type QuestRun = {
  id: string;
  user_id: string;
  circle_id: string;
  quest_key: string;
  title: string;
  finish_condition: string;
  status: QuestStatus;
  before_path: string | null;
  after_path: string | null;
  started_at: string | null;
  completed_at: string | null;
  /** AI progress check result; null = not recorded (treated as photo-only). */
  verification: Verification | null;
  verification_reason: string | null;
  /** Counted toward the 3-per-day cap (earned XP, can be rated); null until completed. */
  credited: boolean | null;
  completion_xp: number;
  xp_after_completion: number | null;
  /** Celebration share code; null until the owner shares the quest. */
  rating_code: string | null;
  /** Chosen at start: AI pass drops rewards instantly, or a giver approves every finish. */
  approval_mode: ApprovalMode;
  /** pending until the AI pass or a giver approves; rejected = sent back for a redo. */
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  /** The giver's "here's what to fix" note from the last redo request; cleared on approval (0010). */
  rejection_reason: string | null;
  /** 1 for the first finish, +1 per resubmit after a redo request (0010). */
  attempt_no: number;
};

export const QUEST_RUN_COLUMNS =
  "id, user_id, circle_id, quest_key, title, finish_condition, status, before_path, after_path, started_at, completed_at, " +
  "verification, verification_reason, credited, completion_xp, xp_after_completion, rating_code, " +
  "approval_mode, approval_status, approved_by, approved_at, rejection_reason, attempt_no";

/**
 * A run the caller can see, or null: their own, or a circle-mate's (RLS, 0009).
 * Check `user_id` before treating it as the caller's.
 */
export async function getQuestRun(id: string): Promise<QuestRun | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quest_runs")
    .select(QUEST_RUN_COLUMNS)
    .eq("id", id)
    .maybeSingle<QuestRun>();
  if (error) throw error;
  return data;
}

/** The caller's draft/active run, if any (at most one, enforced by index). */
export async function getOpenQuestRun(): Promise<QuestRun | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // Circle-mates' runs are readable too, so filter to the caller explicitly.
  const { data, error } = await supabase
    .from("quest_runs")
    .select(QUEST_RUN_COLUMNS)
    .eq("user_id", user.id)
    .in("status", ["draft", "active"])
    .maybeSingle<QuestRun>();
  if (error) throw error;
  return data;
}
