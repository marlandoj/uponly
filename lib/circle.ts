import { isHouseholdRole, type HouseholdRole } from "@/lib/householdRole";
import { createClient } from "@/lib/supabase/server";

export type Circle = { id: string; name: string; join_code: string };

/** The signed-in user's circle (one per user), or null. RLS scopes the read. */
export async function getMyCircle(): Promise<Circle | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("circles")
    .select("id, name, join_code")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** The signed-in user's household role in their circle, or null if signed out / not in one. */
export async function getMyHouseholdRole(): Promise<HouseholdRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("circle_members")
    .select("household_role")
    .eq("user_id", user.id)
    .maybeSingle<{ household_role: string }>();
  if (error) throw error;
  const role = data?.household_role;
  return isHouseholdRole(role) ? role : null;
}
