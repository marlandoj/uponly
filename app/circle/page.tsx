import { redirect } from "next/navigation";
import { getMyCircle } from "@/lib/circle";
import { createCircle, joinCircle } from "./actions";

export default async function CirclePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getMyCircle()) redirect("/");
  const { error } = await searchParams;

  return (
    <>
      <h1>Your circle</h1>
      <p className="muted">
        ChoreQuest is played with your household. Start a circle or join one with its code.
      </p>
      {error && <p className="error">{error}</p>}

      <form action={createCircle} className="card">
        <h2>Start a circle</h2>
        <label>
          Circle name
          <input name="name" maxLength={40} placeholder="The Loot Squad" required />
        </label>
        <button type="submit">Create circle</button>
      </form>

      <form action={joinCircle} className="card">
        <h2>Join a circle</h2>
        <label>
          6-character code
          <input
            name="code"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={7}
            placeholder="HK7M2Q"
            required
          />
        </label>
        <button type="submit">Join circle</button>
      </form>
    </>
  );
}
