"use server";

import { redirect } from "next/navigation";
import { isHouseholdRole, parseHouseholdRole } from "@/lib/householdRole";
import { normalizeJoinCode } from "@/lib/joinCode";
import { createClient } from "@/lib/supabase/server";

const fail = (msg: string): never => redirect(`/circle?error=${encodeURIComponent(msg)}`);
const BAD_ROLE = "Pick “I'm a parent” or “I'm a kid”";

/** The picker's value; missing → `fallback`, anything else unrecognized → error. */
function readHouseholdRole(formData: FormData, fallback: "parent" | "kid") {
  const raw = formData.get("householdRole");
  if (raw !== null && !isHouseholdRole(raw)) fail(BAD_ROLE);
  return parseHouseholdRole(raw, fallback);
}

export async function createCircle(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 40) fail("Circle name must be 1–40 characters");
  const householdRole = readHouseholdRole(formData, "parent");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_circle", { p_name: name, p_household_role: householdRole });
  if (error) fail(error.message);
  redirect("/");
}

export async function joinCircle(formData: FormData) {
  const code = normalizeJoinCode(String(formData.get("code") ?? ""));
  if (!code) fail("That doesn't look like a 6-character circle code");
  const householdRole = readHouseholdRole(formData, "kid");

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_circle", { p_code: code, p_household_role: householdRole });
  if (error) fail(error.code === "P0002" ? "No circle with that code" : error.message);
  redirect("/");
}
