"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MANUAL_FULFILLMENT_REF } from "@/lib/fulfillment";
import { parseRewardForm } from "@/lib/rewards";
import { createClient } from "@/lib/supabase/server";

// Forms that create rewards; errors bounce back to the one that posted.
const REWARD_FORMS = ["/rewards/new", "/rewards/shop"];

/** Food rewards, game credit packs, and Fortnite shop drops all land here. */
export async function createReward(formData: FormData) {
  const from = String(formData.get("from") ?? "");
  const back = REWARD_FORMS.includes(from) ? from : "/rewards/new";
  const parsed = parseRewardForm({
    name: formData.get("name"),
    description: formData.get("description"),
    value: formData.get("value"),
    fulfillment: formData.get("fulfillment"),
    questKey: formData.get("quest"),
    kind: formData.get("kind"),
    game: formData.get("game"),
    imageUrl: formData.get("imageUrl"),
  });
  if (!parsed.ok) redirect(`${back}?error=${encodeURIComponent(parsed.error)}`);

  const r = parsed.value;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_reward", {
    p_name: r.name,
    p_description: r.description,
    p_value_cents: r.valueCents,
    p_fulfillment: r.fulfillment,
    p_quest_key: r.questKey,
    p_game: r.game,
    p_kind: r.kind,
    p_image_url: r.imageUrl,
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/rewards");
  redirect("/rewards");
}

/** The GameMaster hands the reward over in real life and marks it done. */
export async function markFulfilled(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_earning_fulfilled", {
    p_earning_id: id,
    p_fulfillment_ref: MANUAL_FULFILLMENT_REF,
  });
  if (error) redirect(`/rewards/queue?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/rewards/queue");
  redirect("/rewards/queue");
}
