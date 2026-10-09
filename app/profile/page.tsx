import Link from "next/link";
import { redirect } from "next/navigation";
import { PROFILE_GAMES } from "@/lib/gamerProfile";
import { createClient } from "@/lib/supabase/server";
import { saveGamerProfile } from "./actions";

type GamerProfile = { gamer_tag: string | null; games: string[] };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("gamer_tag, games")
    .eq("id", user.id)
    .maybeSingle<GamerProfile>();
  if (readError) throw readError;
  const { data: membership } = await supabase
    .from("circle_members")
    .select("household_role")
    .eq("user_id", user.id)
    .maybeSingle<{ household_role: string }>();
  const isGameMaster = membership?.household_role === "gamemaster";
  const { error, saved } = await searchParams;

  return (
    <>
      <h1>{isGameMaster ? "GameMaster profile" : "Gamer profile"}</h1>
      <p className="muted">
        {isGameMaster
          ? "Your name, as your squad sees it."
          : "Tell your household where your loot should go. Just a label — nothing is looked up or linked."}
      </p>
      {error && <p className="error">{error}</p>}
      {saved && !error && <p className="notice saved-banner" role="status">Saved ✓</p>}
      <form action={saveGamerProfile} className="card">
        <label>
          {isGameMaster ? "GameMaster name" : "Gamer tag"}
          <input
            name="gamer_tag"
            maxLength={32}
            autoComplete="off"
            autoCapitalize="none"
            placeholder={isGameMaster ? "TheBoss" : "NinjaKid42"}
            defaultValue={profile?.gamer_tag ?? ""}
          />
        </label>
        {!isGameMaster && (
          <fieldset className="card">
            <legend>Games I play</legend>
            {PROFILE_GAMES.map((g) => (
              <label key={g} className="choice">
                <input type="checkbox" name="games" value={g} defaultChecked={profile?.games.includes(g)} />
                {g}
              </label>
            ))}
          </fieldset>
        )}
        <button type="submit">Save</button>
      </form>
      <Link href="/" className="muted center">Back to squad</Link>
    </>
  );
}
