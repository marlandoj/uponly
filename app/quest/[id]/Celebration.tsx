import { BossBar, LevelTick } from "@/app/Celebrate";
import { bossesDefeatedBetween } from "@/lib/boss";
import { RATING_LABELS } from "@/lib/celebration";
import { qrDataUrl, ratingUrl } from "@/lib/celebrationData";
import type { QuestRun } from "@/lib/questRuns";
import { isRating, type Rating } from "@/lib/rating";
import { createClient } from "@/lib/supabase/server";
import { shareQuest } from "../actions";
import ShareButton from "./ShareButton";

type ReceivedRating = {
  id: string;
  rating: Rating;
  counted: boolean;
  level_before: number;
  level_after: number;
  first_fold: boolean;
  rater: { display_name: string } | null;
};

/** Completion XP, Boss bar, share code (QR / link / code) and ratings received. */
export default async function Celebration({ run }: { run: QuestRun }) {
  const supabase = await createClient();
  const [{ data: profile, error: profileError }, { data: ratings, error: ratingsError }] = await Promise.all([
    supabase.from("profiles").select("xp").eq("id", run.user_id).single<{ xp: number }>(),
    supabase
      .from("quest_ratings")
      .select("id, rating, counted, level_before, level_after, first_fold, rater:profiles!quest_ratings_rater_id_fkey(display_name)")
      .eq("run_id", run.id)
      .order("created_at")
      .overrideTypes<ReceivedRating[], { merge: false }>(),
  ]);
  if (profileError) throw profileError;
  if (ratingsError) throw ratingsError;

  const xpAfter = run.xp_after_completion ?? 0;
  const bosses = run.completion_xp > 0 ? bossesDefeatedBetween(xpAfter - run.completion_xp, xpAfter) : [];

  return (
    <>
      <section className="card celebrate">
        {run.credited ? (
          <p className="notice">+{run.completion_xp} XP</p>
        ) : (
          <p className="muted">Bonus quest! You&apos;ve hit today&apos;s 3 XP quests — this one&apos;s for the love of it.</p>
        )}
        {bosses.map((b) => (
          <p key={b} className="boss-defeated">⚔️ You defeated the {b}!</p>
        ))}
        <BossBar xp={profile.xp} />
      </section>

      {run.rating_code ? (
        <ShareCard code={run.rating_code} />
      ) : run.credited ? (
        <form action={shareQuest} className="card">
          <h2>Celebrate with your circle</h2>
          <p className="muted">
            Get a QR code, link and 6-character code. Circle-mates see your before and after photos
            and rate it Done, Great or Legendary.
          </p>
          <input type="hidden" name="id" value={run.id} />
          <button type="submit">Share for celebration</button>
        </form>
      ) : null}

      {ratings.length > 0 && (
        <section className="card">
          <h2>Celebrations</h2>
          <ul className="roster">
            {ratings.map((r) => (
              <li key={r.id}>
                <span>
                  {r.rater?.display_name ?? "A circle-mate"}:{" "}
                  {isRating(r.rating) && `${RATING_LABELS[r.rating].emoji} ${RATING_LABELS[r.rating].label}`}
                </span>
                {r.counted && <LevelTick label="Level" from={r.level_before} to={r.level_after} />}
              </li>
            ))}
          </ul>
          {ratings.some((r) => r.first_fold) && <p className="badge">🏅 First Fold badge unlocked!</p>}
        </section>
      )}
    </>
  );
}

async function ShareCard({ code }: { code: string }) {
  const url = await ratingUrl(code);
  const qr = await qrDataUrl(url);
  return (
    <section className="card share">
      <h2>Celebrate with your circle</h2>
      {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL */}
      <img className="qr" src={qr} alt={`QR code for ${url}`} width={220} height={220} />
      <p className="code">{code}</p>
      <p className="muted center">
        Scan, open <a href={url}>{url.replace(/^https?:\/\//, "")}</a>, or enter the code under
        &ldquo;Celebrate a quest&rdquo;. Only your circle can see it.
      </p>
      <ShareButton url={url} />
    </section>
  );
}
