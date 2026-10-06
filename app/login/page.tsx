import { safeNext } from "@/lib/safeNext";
import { sendMagicLink, signInWithX } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; next?: string }>;
}) {
  const { sent, error, next } = await searchParams;
  const dest = safeNext(next);

  return (
    <>
      <h1>UpOnly</h1>
      <p className="muted">The chore game where your level only goes up.</p>
      <form action={signInWithX} className="card">
        {dest && <input type="hidden" name="next" value={dest} />}
        <button type="submit">Continue with X</button>
      </form>
      <p className="muted">Or sign in with an email link:</p>
      <form action={sendMagicLink} className="card">
        <label>
          Email
          <input name="email" type="email" inputMode="email" autoComplete="email" required />
        </label>
        {dest && <input type="hidden" name="next" value={dest} />}
        <button type="submit" className="secondary">Send magic link</button>
        {sent && <p className="notice">Check your email for a sign-in link.</p>}
        {error && <p className="error">{error}</p>}
      </form>
    </>
  );
}
