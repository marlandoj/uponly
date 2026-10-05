import type { Verification } from "@/lib/rating";
import { createClient } from "@/lib/supabase/server";

export type QuestStatus = "draft" | "active" | "completed" | "abandoned";

export type QuestRun = {
  id: string;
  user_id: string;
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
};

const COLUMNS =
  "id, user_id, quest_key, title, finish_condition, status, before_path, after_path, started_at, completed_at, " +
  "verification, verification_reason";

/** One of the caller's own runs (RLS is owner-only), or null. */
export async function getQuestRun(id: string): Promise<QuestRun | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quest_runs")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle<QuestRun>();
  if (error) throw error;
  return data;
}

/** The caller's draft/active run, if any (at most one, enforced by index). */
export async function getOpenQuestRun(): Promise<QuestRun | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quest_runs")
    .select(COLUMNS)
    .in("status", ["draft", "active"])
    .maybeSingle<QuestRun>();
  if (error) throw error;
  return data;
}
