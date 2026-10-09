import { redirect } from "next/navigation";
import { getMyCircle } from "@/lib/circle";
import { createCircle, joinCircle } from "./actions";
import RolePicker from "./RolePicker";

export default async function CirclePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getMyCircle()) redirect("/");
  const { error } = await searchParams;

  return (
    <>
      <h1>Your squad</h1>
      <p className="muted">
        ChoreQuest is played with your household. Start a squad or join one with its code.
      </p>
      {error && <p className="error">{error}</p>}

      <form action={createCircle} className="card">
        <h2>Start a squad</h2>
        <label>
          Squad name
          <input name="name" maxLength={40} placeholder="The Loot Squad" required />
        </label>
        <RolePicker defaultRole="gamemaster" />
        <button type="submit">Create squad</button>
      </form>

      <form action={joinCircle} className="card">
        <h2>Join a squad</h2>
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
        <RolePicker defaultRole="gamer" />
        <button type="submit">Join squad</button>
      </form>
    </>
  );
}
