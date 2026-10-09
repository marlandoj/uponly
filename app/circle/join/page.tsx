import { redirect } from "next/navigation";
import { normalizeJoinCode } from "@/lib/joinCode";
import { joinInvitePath } from "@/lib/joinInvite";
import { createClient } from "@/lib/supabase/server";

const fail = (msg: string): never => redirect(`/circle?error=${encodeURIComponent(msg)}`);

/**
 * QR join-link: /circle/join?code=XXXXXX.
 * Signed in → join the squad (via the join_circle RPC, like the form) and go home.
 * Signed out → through the login flow, landing back here afterward.
 */
export default async function CircleJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const { code: raw } = await searchParams;
  const code = normalizeJoinCode(Array.isArray(raw) ? raw[0] ?? "" : raw ?? "");
  if (!code) return fail("That doesn't look like a 6-character squad code");
  const invitePath = joinInvitePath(code);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(invitePath)}`);

  const { error } = await supabase.rpc("join_circle", { p_code: code });
  if (error) return fail(error.code === "P0002" ? "No squad with that code" : error.message);
  redirect("/");
}
