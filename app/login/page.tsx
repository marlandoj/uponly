import { sendMagicLink } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <>
      <h1>UpOnly</h1>
      <p className="muted">The chore game where your level only goes up.</p>
      <form action={sendMagicLink} className="card">
        <label>
          Email
          <input name="email" type="email" inputMode="email" autoComplete="email" required />
        </label>
        <button type="submit">Send magic link</button>
        {sent && <p className="notice">Check your email for a sign-in link.</p>}
        {error && <p className="error">{error}</p>}
      </form>
    </>
  );
}
