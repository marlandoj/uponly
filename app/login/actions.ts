"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NEXT_COOKIE, safeNext } from "@/lib/safeNext";
import { createClient } from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/login?error=Enter+a+valid+email");
  }

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  await rememberNext(formData, origin);
  redirect("/login?sent=1");
}

// Carried in a cookie (not the redirect URL) so it can't break the
// Supabase redirect-URL allow-list match.
async function rememberNext(formData: FormData, origin: string) {
  const next = safeNext(formData.get("next"));
  if (next) {
    (await cookies()).set(NEXT_COOKIE, next, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https:"),
      path: "/auth",
      maxAge: 60 * 60,
    });
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
