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
      <h1>Your squad</h1>
      <p className="muted">
        ChoreQuest is played with your household. Start a squad or join one with its code.
      </p>
      {error && <p className="error">{error}</p>}

      <form action={createCircle} className="card">
        <h2>Start a squad</h2>
        <p className="muted">🛡️ Creating a squad makes you its GameMaster — you approve quests and control the loot.</p>
        <label>
          Squad name
          <input name="name" maxLength={40} placeholder="The Loot Squad" required />
        </label>
        <button type="submit">Create squad</button>
      </form>

      <form action={joinCircle} className="card">
        <h2>Join a squad</h2>
        <p className="muted">🎮 Joining a squad makes you a gamer — do chores, earn loot.</p>
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
        <button type="submit">Join squad</button>
      </form>
    </>
  );
}
