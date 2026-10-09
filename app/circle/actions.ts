"use server";

import { redirect } from "next/navigation";
import { normalizeJoinCode } from "@/lib/joinCode";
import { createClient } from "@/lib/supabase/server";

const fail = (msg: string): never => redirect(`/circle?error=${encodeURIComponent(msg)}`);

/** Creating a squad makes you its GameMaster (create_circle always writes household_role='gamemaster'). */
export async function createCircle(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 40) fail("Squad name must be 1–40 characters");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_circle", { p_name: name });
  if (error) fail(error.message);
  redirect("/");
}

/** Joining a squad makes you a gamer (join_circle always writes household_role='gamer'). */
export async function joinCircle(formData: FormData) {
  const code = normalizeJoinCode(String(formData.get("code") ?? ""));
  if (!code) fail("That doesn't look like a 6-character squad code");

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_circle", { p_code: code });
  if (error) fail(error.code === "P0002" ? "No squad with that code" : error.message);
  redirect("/");
}
