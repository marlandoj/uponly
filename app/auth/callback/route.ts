import { NextResponse, type NextRequest } from "next/server";
import { NEXT_COOKIE, safeNext } from "@/lib/safeNext";
import { createClient } from "@/lib/supabase/server";

// Magic-link landing: exchange the PKCE code for a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const next = safeNext(request.cookies.get(NEXT_COOKIE)?.value) ?? "/";
      const response = NextResponse.redirect(`${origin}${next}`);
      response.cookies.delete({ name: NEXT_COOKIE, path: "/auth" });
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Sign-in+link+expired+or+invalid`);
}
