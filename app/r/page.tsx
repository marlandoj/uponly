import Link from "next/link";
import { openCode } from "./actions";

export default async function EnterCodePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <>
      <h1>Celebrate a quest</h1>
      <p className="muted">Enter the 6-character code from a squadmate&apos;s finished quest.</p>
      {error && <p className="error">{error}</p>}
      <form action={openCode} className="card">
        <label>
          Quest code
          <input
            name="code"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={7}
            placeholder="QM4X7P"
            required
          />
        </label>
        <button type="submit">Open quest</button>
      </form>
      <Link href="/" className="muted center">Back to squad</Link>
    </>
  );
}
