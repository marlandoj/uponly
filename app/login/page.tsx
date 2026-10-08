import { safeNext } from "@/lib/safeNext";
import { sendMagicLink } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; next?: string }>;
}) {
  const { sent, error, next } = await searchParams;
  const dest = safeNext(next);

  return (
    <>
      <h1>Drop in</h1>
      <p className="muted">ChoreQuest: real chores, epic loot. Your level only goes up.</p>
      <form action={sendMagicLink} className="card">
        <label>
          Email
          <input name="email" type="email" inputMode="email" autoComplete="email" required />
        </label>
        {dest && <input type="hidden" name="next" value={dest} />}
        <button type="submit">Send magic link</button>
        {sent && <p className="notice">Check your email for a sign-in link.</p>}
        {error && <p className="error">{error}</p>}
      </form>
    </>
  );
}
