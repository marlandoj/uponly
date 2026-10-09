import Link from "next/link";
import { redirect } from "next/navigation";
import { bossState } from "@/lib/boss";
import { getMyCircle } from "@/lib/circle";
import { playerName } from "@/lib/playerName";
import { createClient } from "@/lib/supabase/server";
import BackButton from "@/app/BackButton";

type Row = {
  id: string;
  display_name: string;
  gamer_tag: string | null;
  level: number;
  xp: number;
  streak: number;
  quests_completed: number;
};

/**
 * Squad-only leaderboard. Ranked by chore level, then streak, then quests
 * completed — the spec's order. RLS scopes profiles to squadmates, so this
 * query can never leak another squad's members.
 */
export default async function Leaderboard() {
  const circle = await getMyCircle();
  if (!circle) redirect("/circle");

  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from("circle_members")
    .select("profiles(id, display_name, gamer_tag, level, xp, streak, quests_completed)")
    .eq("circle_id", circle.id)
    .overrideTypes<{ profiles: Row | null }[], { merge: false }>();
  if (error) throw error;

  const rows = (members ?? [])
    .map((m) => m.profiles)
    .filter((p): p is Row => p !== null)
    .sort(
      (a, b) =>
        Number(b.level) - Number(a.level) ||
        b.streak - a.streak ||
        b.quests_completed - a.quests_completed,
    );

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <>
      <BackButton />      <h1>Leaderboard</h1>
      <p className="muted">{circle.name} · ranked by level, then streak, then quests</p>

      <section className="card">
        {rows.length === 0 ? (
          <p className="muted">No members yet.</p>
        ) : (
          <ol className="roster leaderboard">
            {rows.map((p, i) => {
              const boss = bossState(p.xp);
              return (
                <li key={p.id}>
                  <span className="rank">{medals[i] ?? `${i + 1}.`}</span>
                  <span className="who">
                    <strong>{playerName(p)}</strong>
                    <span className="muted">
                      {" "}
                      · 👾 {boss.name} ({boss.defeated} defeated)
                    </span>
                  </span>
                  <span className="stats">
                    <span title="Chore level">{Number(p.level).toFixed(2)}</span>
                    {p.streak > 1 && <span title={`${p.streak}-day streak`}> 🔥{p.streak}</span>}
                    <span className="muted" title="Quests completed">
                      {" "}
                      · {p.quests_completed} quests
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <p className="muted">
        Streaks count consecutive days with a completed quest. Levels only ever
        go up — ratings never subtract.
      </p>
    </>
  );
}
