"use server";

import { redirect } from "next/navigation";
import { parseApprovalMode, parseCommentBody, parseRejectionReason } from "@/lib/approval";
import { resolveQuestChoice } from "@/lib/quests";
import { earnRewardsForRun, supabaseRewardStore, type EarnedReward } from "@/lib/rewards";
import { createClient } from "@/lib/supabase/server";

const fail = (msg: string): never => redirect(`/quest?error=${encodeURIComponent(msg)}`);

export async function startQuest(formData: FormData) {
  // One radio group for the whole catalog: value is "<quest key>::<finish condition>".
  const [questKey = "", condition = ""] = String(formData.get("pick") ?? "").split("::");
  const choice = resolveQuestChoice(questKey, condition);
  if (!choice) return fail("Pick a quest and how you'll know it's finished");

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("start_quest", {
      p_quest_key: choice.quest.key,
      p_title: choice.quest.title,
      p_finish_condition: choice.finishCondition,
      p_approval_mode: parseApprovalMode(formData.get("approvalMode")),
    })
    .single<{ id: string }>();
  if (error) return fail(error.message);
  redirect(`/quest/${data.id}`);
}

export async function abandonQuest(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("abandon_quest", { p_run_id: id });
  if (error) redirect(`/quest/${encodeURIComponent(id)}?error=${encodeURIComponent(error.message)}`);
  redirect("/quest");
}

export async function shareQuest(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("share_quest", { p_run_id: id });
  const back = `/quest/${encodeURIComponent(id)}`;
  redirect(error ? `${back}?error=${encodeURIComponent(error.message)}` : back);
}

/** Owner deletes their evidence photos. Ratings already given stay. */
export async function deleteQuestPhotos(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const back = `/quest/${encodeURIComponent(id)}`;
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("delete_quest_photos", { p_run_id: id })
    .single<{ before_path: string | null; after_path: string | null }>();
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  const paths = [data.before_path, data.after_path].filter((p): p is string => !!p);
  if (paths.length > 0) {
    // Owner-delete storage policy covers this; DB refs are already cleared,
    // so a storage failure only orphans invisible files.
    const { error: rmError } = await supabase.storage.from("evidence").remove(paths);
    if (rmError) console.warn("deleteQuestPhotos: storage remove failed:", rmError.message);
  }
  redirect(back);
}

const isRunId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
const runPage = (id: string, query = "") => `/quest/${encodeURIComponent(id)}${query}`;

/** Circle-mate or owner comments on a run (RLS: circle members, as themselves). */
export async function postComment(runId: string, body: unknown): Promise<{ error: string | null }> {
  const parsed = parseCommentBody(body);
  if (!parsed.ok) return { error: parsed.error };
  if (!isRunId(runId)) return { error: "Quest not found" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first" };
  const { error } = await supabase
    .from("run_comments")
    .insert({ run_id: runId, author_id: user.id, body: parsed.body });
  return { error: error ? "Couldn't post that comment" : null };
}

export async function submitComment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { error } = await postComment(id, formData.get("body"));
  redirect(runPage(id, error ? `?error=${encodeURIComponent(error)}#comments` : "#comments"));
}

/**
 * A giver approves a finished run (rewards drop for its player) or asks for a
 * redo with a required note (what to fix, 1–300 chars — approve_run re-checks
 * it). approve_run enforces who may review; on approval the earn flow runs
 * with the giver's session (record_reward_earning allows circle-mates once a
 * run is approved) and never fails the approval.
 */
export async function approveRun(
  runId: string,
  approve: boolean,
  reason: unknown = null,
): Promise<{ error: string | null; rewards: EarnedReward[] }> {
  if (!isRunId(runId)) return { error: "Quest not found", rewards: [] };
  let pReason: string | null = null;
  if (!approve) {
    const parsed = parseRejectionReason(reason);
    if (!parsed.ok) return { error: parsed.error, rewards: [] };
    pReason = parsed.reason;
  }
  const supabase = await createClient();
  const { data: run, error } = await supabase
    .rpc("approve_run", { p_run_id: runId, p_approve: approve, p_reason: pReason })
    .single<{ id: string; user_id: string; circle_id: string; quest_key: string }>();
  if (error) return { error: error.message, rewards: [] };
  const rewards = approve ? await earnRewardsForRun(supabaseRewardStore(supabase), run) : [];
  return { error: null, rewards };
}

export async function submitReview(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const approve = formData.get("decision") === "approve";
  const { error, rewards } = await approveRun(id, approve, formData.get("reason"));
  if (error) redirect(runPage(id, `?error=${encodeURIComponent(error)}`));
  // The page reloads the loot from reward_earnings; the flag plays the drop.
  redirect(runPage(id, approve ? (rewards.length > 0 ? "?approved=drop" : "?approved=1") : "?redo=1"));
}
