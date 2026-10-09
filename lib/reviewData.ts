import { reviewQueue } from "@/lib/approval";
import { PHOTO_URL_TTL_SECONDS, isEvidencePathFor } from "@/lib/celebration";
import { QUEST_RUN_COLUMNS, type QuestRun } from "@/lib/questRuns";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Page reads for the run page's review + comments (0009_visual_verification.sql)
// and the squad home's review queue (0010_review_queue.sql).

export type RunComment = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: { display_name: string } | null;
};

/** A run's comments, oldest first (RLS: circle members only). */
export async function getRunComments(runId: string): Promise<RunComment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("run_comments")
    .select("id, author_id, body, created_at, author:profiles(display_name)")
    .eq("run_id", runId)
    .order("created_at")
    .overrideTypes<RunComment[], { merge: false }>();
  if (error) throw error;
  return data;
}

export type RunEvidence = { before: string | null; after: string | null };

/**
 * 5-minute signed URLs for a run's before/after evidence. Storage is
 * owner-only, so this signs with the service-role client — call it only with
 * a run read through the caller's RLS (getQuestRun), which is the circle
 * membership check. Without the service key, evidence is unavailable.
 */
export async function signRunEvidence(
  run: Pick<QuestRun, "id" | "user_id" | "before_path" | "after_path">,
): Promise<RunEvidence> {
  const admin = createAdminClient();
  const paths = [run.before_path, run.after_path].filter((p) => isEvidencePathFor(p, run.user_id, run.id));
  if (!admin || paths.length === 0) return { before: null, after: null };

  const { data, error } = await admin.storage.from("evidence").createSignedUrls(paths, PHOTO_URL_TTL_SECONDS);
  if (error) {
    console.warn("review: couldn't sign evidence URLs:", error.message);
    return { before: null, after: null };
  }
  const url = (p: string | null) => data.find((d) => d.path === p && !d.error)?.signedUrl ?? null;
  return { before: url(run.before_path), after: url(run.after_path) };
}

const QUEUE_LIMIT = 20;

export type QueuedRun = { run: QuestRun; evidence: RunEvidence };

/**
 * Squadmates' finishes waiting for the viewer's review, newest first, with
 * signed thumbnails. RLS (0009 "circle read") limits the read to the viewer's
 * circle — the membership check signRunEvidence relies on. Empty for anyone
 * whose only pending run is their own.
 */
export async function getReviewQueue(viewerId: string, circleId: string): Promise<QueuedRun[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quest_runs")
    .select(QUEST_RUN_COLUMNS)
    .eq("circle_id", circleId)
    .eq("status", "completed")
    .eq("approval_status", "pending")
    .neq("user_id", viewerId)
    .order("completed_at", { ascending: false })
    .limit(QUEUE_LIMIT)
    .overrideTypes<QuestRun[], { merge: false }>();
  if (error) throw error;
  const runs = reviewQueue(viewerId, true, data);
  return Promise.all(runs.map(async (run) => ({ run, evidence: await signRunEvidence(run) })));
}
