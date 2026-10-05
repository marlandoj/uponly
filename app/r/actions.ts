"use server";

import { redirect } from "next/navigation";
import { normalizeRatingCode, ratingPath } from "@/lib/celebration";
import { isRating } from "@/lib/rating";
import { createClient } from "@/lib/supabase/server";

export async function openCode(formData: FormData) {
  const code = normalizeRatingCode(String(formData.get("code") ?? ""));
  if (!code) redirect(`/r?error=${encodeURIComponent("That doesn't look like a 6-character code")}`);
  redirect(ratingPath(code));
}

export async function rateQuest(formData: FormData) {
  const code = normalizeRatingCode(String(formData.get("code") ?? ""));
  if (!code) redirect("/r");
  const rating = Number(formData.get("rating"));
  const back = ratingPath(code);
  if (!isRating(rating)) redirect(`${back}?error=${encodeURIComponent("Pick Done, Great or Legendary")}`);

  // rate_quest re-checks everything: circle membership, no self-rating, the
  // 24-hour member rule, one rating per quest and the daily caps.
  const supabase = await createClient();
  const { error } = await supabase.rpc("rate_quest", { p_code: code, p_rating: rating });
  if (error && error.code !== "23505") {
    redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  }
  redirect(back);
}
