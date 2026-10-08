import Link from "next/link";
import { notFound } from "next/navigation";
import { BossBar, LevelTick } from "@/app/Celebrate";
import { bossesDefeatedBetween } from "@/lib/boss";
import { NOT_COUNTED_MESSAGES, RATING_LABELS, normalizeRatingCode, type Celebration } from "@/lib/celebration";
import { getCelebration, signCelebrationPhotos } from "@/lib/celebrationData";
import { isRating } from "@/lib/rating";
import Evidence from "@/app/quest/[id]/Evidence";
import { rateQuest } from "../actions";

// Signed photo URLs expire after 5 minutes; never serve this page from cache.
export const dynamic = "force-dynamic";

export default async function RatePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const code = normalizeRatingCode((await params).code);
  if (!code) notFound();
  const c = await getCelebration(code);
  const { error } = await searchParams;

  if (!c) {
    return (
      <>
        <h1>Quest not found</h1>
        <section className="card">
          <p>
            No finished quest with code <strong>{code}</strong> in your circle. Celebrations are
            only visible to members of the same circle.
          </p>
          <Link href="/r" className="button">Try another code</Link>
        </section>
        <Link href="/" className="muted center">Back to circle</Link>
      </>
    );
  }

  // get_celebration only returned a row because we're in this circle.
  const photos = await signCelebrationPhotos(c);

  return (
    <>
      <h1>{c.title}</h1>
      <p className="muted">
        <strong>{c.player_name}</strong> finished: <strong>{c.finish_condition}</strong>
      </p>
      {error && <p className="error">{error}</p>}

      <section className="card">
        <div className="photos">
          <Evidence label="Before" src={photos.before} path={c.before_path} />
          <Evidence label="After" src={photos.after} path={c.after_path} />
        </div>
        <p className="muted">
          {c.verification === "pass"
            ? "✅ AI check: looks done!"
            : "📸 Photo-only — you're the judge."}
        </p>
      </section>

      <Verdict c={c} code={code} />

      <Link href="/" className="muted center">Back to circle</Link>
    </>
  );
}

function Verdict({ c, code }: { c: Celebration; code: string }) {
  switch (c.eligibility) {
    case "self":
      return (
        <section className="card">
          <p>This is your quest! Share its code with your circle so they can celebrate it.</p>
          <Link href={`/quest/${c.run_id}`} className="button">Show share code</Link>
        </section>
      );
    case "new_member":
      return (
        <section className="card">
          <p>
            Welcome to the circle! To keep things fair, you can celebrate quests that start at
            least 24 hours after you joined — from{" "}
            <strong>{new Date(c.can_rate_from).toUTCString().slice(0, 22)} UTC</strong>.
          </p>
        </section>
      );
    case "rated":
      return <RatedResult c={c} />;
    case "ok":
      return (
        <form action={rateQuest} className="card">
          <h2>How did {c.player_name} do?</h2>
          <input type="hidden" name="code" value={code} />
          <div className="ratings">
            {([3, 4, 5] as const).map((r) => (
              <button key={r} type="submit" name="rating" value={r}>
                <span aria-hidden="true">{RATING_LABELS[r].emoji}</span> {RATING_LABELS[r].label}
              </button>
            ))}
          </div>
          <p className="muted">Every rating is a celebration — levels only go up.</p>
        </form>
      );
  }
}

function RatedResult({ c }: { c: Celebration }) {
  const r = isRating(c.my_rating) ? RATING_LABELS[c.my_rating] : null;
  const xpAfter = c.my_xp_after ?? 0;
  const xp = c.my_xp_awarded ?? 0;
  const bosses = c.my_counted ? bossesDefeatedBetween(xpAfter - xp, xpAfter) : [];

  return (
    <section className="card celebrate">
      <h2>
        {r ? `${r.emoji} You called it ${r.label}!` : "You celebrated this quest!"}
      </h2>
      {c.my_counted ? (
        <>
          <LevelTick label={`${c.player_name}'s chore level`} from={c.my_level_before} to={c.my_level_after} />
          <p className="notice">+{xp} XP for {c.player_name}</p>
          {bosses.map((b) => (
            <p key={b} className="boss-defeated">⚔️ {c.player_name} defeated the {b}!</p>
          ))}
          {c.my_first_fold && (
            <p className="badge">🏅 First Fold badge unlocked for {c.player_name}!</p>
          )}
          <BossBar xp={xpAfter} />
        </>
      ) : (
        <p className="muted">{c.my_not_counted ? NOT_COUNTED_MESSAGES[c.my_not_counted] : null}</p>
      )}
    </section>
  );
}
