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
