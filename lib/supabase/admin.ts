import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

// Service-role client for server-only writes that players must not be able to
// make themselves (e.g. recording their own AI verdict). Bypasses RLS — never
// import this from a client component. Returns null when the key isn't set so
// callers can degrade instead of crashing.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
