import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CHECK_TIMEOUT_MS,
  checkProgress,
  photoOnly,
  raceSignal,
  visionConfigFromEnv,
  type ProgressCheckResult,
} from "@/lib/progressCheck";
import type { QuestRun } from "@/lib/questRuns";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Runs the progress check for a just-completed run and records the result.
 * Loading the before photo and the vision call share one CHECK_TIMEOUT_MS
 * deadline. Never throws: the quest is already completed when this runs.
 */
export async function verifyCompletedRun(
  supabase: SupabaseClient,
  run: Pick<QuestRun, "id" | "title" | "finish_condition" | "before_path">,
  after: Uint8Array,
): Promise<ProgressCheckResult> {
  const result = await runCheck(supabase, run, after);
  await record(run.id, result);
  return result;
}

async function runCheck(
  supabase: SupabaseClient,
  run: Pick<QuestRun, "title" | "finish_condition" | "before_path">,
  after: Uint8Array,
): Promise<ProgressCheckResult> {
  const { apiKey, model } = visionConfigFromEnv();
  if (!apiKey) return photoOnly("off");
  if (!run.before_path) return photoOnly("unavailable");

  const signal = AbortSignal.timeout(CHECK_TIMEOUT_MS);
  try {
    const { data, error } = await raceSignal(
      supabase.storage.from("evidence").download(run.before_path),
      signal,
    );
    if (error || !data) throw error ?? new Error("before photo missing");
    const before = new Uint8Array(await raceSignal(data.arrayBuffer(), signal));
    return await checkProgress(
      { questTitle: run.title, finishCondition: run.finish_condition, before, after },
      { apiKey, model, signal },
    );
  } catch (e) {
    if (!signal.aborted) console.warn("progress check: couldn't load before photo:", e);
    return photoOnly(signal.aborted ? "timeout" : "unavailable");
  }
}

async function record(runId: string, result: ProgressCheckResult) {
  const admin = createAdminClient();
  if (!admin) {
    console.warn("progress check: SUPABASE_SERVICE_ROLE_KEY not set; verdict not saved (treated as photo-only)");
    return;
  }
  try {
    const { error } = await admin
      .from("quest_runs")
      .update({
        verification: result.verification,
        verification_reason: result.reason,
        verified_at: new Date().toISOString(),
      })
      .eq("id", runId)
      .eq("status", "completed")
      .is("verification", null);
    if (error) throw error;
  } catch (e) {
    console.warn("progress check: couldn't save verdict:", e instanceof Error ? e.message : e);
  }
}
