"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNext } from "@/lib/safeNext";
import { createClient } from "@/lib/supabase/client";

// Guest entry: one tap signs the visitor in anonymously (a real Supabase user
// id) and drops them straight into the app. No email, no magic links, no wait.
function DropIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dest = safeNext(searchParams.get("next")) ?? "/";
  const linkError = searchParams.get("error");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function dropIn() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInAnonymously();
    if (authError || !data.user) {
      setError("Guest access isn't available right now — try again in a bit.");
      setBusy(false);
      return;
    }
    router.refresh();
    router.replace(dest);
  }

  return (
    <>
      <h1>Drop in</h1>
      <p className="muted">ChoreQuest: real-life chores, epic in-game loot. Your level only goes up.</p>
      <div className="card">
        <p className="muted">No account, no email, no waiting — jump straight in as a guest.</p>
        <button type="button" onClick={dropIn} disabled={busy} className="dropin-hero">
          {busy ? "Dropping in…" : "DROP IN"}
        </button>
        {error && <p className="error">{error}</p>}
        {linkError && !error && <p className="error">{linkError}</p>}
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <DropIn />
    </Suspense>
  );
}
