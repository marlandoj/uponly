"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { researchCatalogForGames } from "@/lib/catalogResearch";
import { parseGamerProfileForm } from "@/lib/gamerProfile";
import { createClient } from "@/lib/supabase/server";

/** Saves the caller's own gamer tag + games via set_gamer_profile (0008). */
export async function saveGamerProfile(formData: FormData) {
  const parsed = parseGamerProfileForm({
    gamerTag: formData.get("gamer_tag"),
    games: formData.getAll("games"),
  });
  if (!parsed.ok) redirect(`/profile?error=${encodeURIComponent(parsed.error)}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_gamer_profile", {
    p_gamer_tag: parsed.value.gamerTag ?? "",
    p_games: parsed.value.games,
  });
  if (error) redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  // Best-effort: cache loot prices for the parent's picker (never blocks the save).
  try {
    await researchCatalogForGames(supabase, parsed.value.games);
  } catch (e) {
    console.warn("saveGamerProfile: catalog research failed:", e);
  }
  revalidatePath("/");
  redirect("/");
}
