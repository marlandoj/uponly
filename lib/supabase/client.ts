import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

// Client-component Supabase client (browser cookies). Sessions created here
// — e.g. the guest "drop in" on /login — are picked up by proxy.ts on the
// next request.
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
