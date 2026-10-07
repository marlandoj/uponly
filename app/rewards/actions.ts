"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MANUAL_FULFILLMENT_REF } from "@/lib/fulfillment";
import { parseRewardForm } from "@/lib/rewards";
import { createClient } from "@/lib/supabase/server";

export async function createReward(formData: FormData) {
  const parsed = parseRewardForm({
    name: formData.get("name"),
    description: formData.get("description"),
    value: formData.get("value"),
    fulfillment: formData.get("fulfillment"),
    questKey: formData.get("quest"),
  });
  if (!parsed.ok) redirect(`/rewards/new?error=${encodeURIComponent(parsed.error)}`);

  const r = parsed.value;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_reward", {
    p_name: r.name,
    p_description: r.description,
    p_value_cents: r.valueCents,
    p_fulfillment: r.fulfillment,
    p_quest_key: r.questKey,
  });
  if (error) redirect(`/rewards/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/rewards");
  redirect("/rewards");
}

/** Parent hands the reward over in real life and marks it done. */
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
