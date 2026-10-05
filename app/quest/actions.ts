"use server";

import { redirect } from "next/navigation";
import { resolveQuestChoice } from "@/lib/quests";
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
