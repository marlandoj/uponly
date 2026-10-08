import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyCircle } from "@/lib/circle";
import { joinInviteUrl } from "@/lib/joinInvite";
import { qrDataUrl } from "@/lib/qr";
import { getReviewQueue } from "@/lib/reviewData";
import { createClient } from "@/lib/supabase/server";
import { BossBar } from "./Celebrate";
import ReviewQueue from "./ReviewQueue";
import { signOut } from "./login/actions";

type Member = {
  role: string;
  household_role: string;
  profiles: { id: string; display_name: string; level: number; xp: number; gamer_tag: string | null } | null;
};

export default async function Home() {
  const circle = await getMyCircle();
  if (!circle) redirect("/circle");

  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from("circle_members")
    .select("role, household_role, profiles(id, display_name, level, xp, gamer_tag)")
    .eq("circle_id", circle.id)
    .order("joined_at")
    .overrideTypes<Member[], { merge: false }>();
  if (error) throw error;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myMembership = members.find((m) => m.profiles?.id === user?.id);
  const me = myMembership?.profiles;
  const isGameMaster = myMembership?.household_role === "gamemaster";
  const queue = me ? await getReviewQueue(me.id, circle.id) : [];
  const players = new Map(members.flatMap((m) => (m.profiles ? [[m.profiles.id, m.profiles] as const] : [])));

  return (
    <>
      <h1>{circle.name}</h1>
      {me && (
        <Link href="/profile" className="loot-chip">
          {me.gamer_tag ? <>🎮 Loot bound for: <strong>{me.gamer_tag}</strong></> : "🎮 Set your gamer tag"}
        </Link>
      )}
      {queue.length > 0 && <ReviewQueue queue={queue} players={players} isGameMaster={isGameMaster} />}

      <Link href="/quest" className="button">Start a quest</Link>
      <Link href="/r" className="button secondary">Celebrate a circle-mate&apos;s quest</Link>
      <Link href="/leaderboard" className="button secondary">Leaderboard</Link>
      <Link href="/rewards" className="button secondary">Rewards &amp; loot</Link>

      {me && (
        <section className="card">
          <h2>Boss battle</h2>
          <BossBar xp={me.xp} />
          <p className="muted">Every finished quest hits the boss for 10 XP (up to 3 a day).</p>
        </section>
      )}

      <section className="card share">
        <h2>Invite to your circle</h2>
        <InviteQr code={circle.join_code} name={circle.name} />
        <p className="code">{circle.join_code}</p>
        <p className="muted">Scan the QR code or share this code so housemates can join and celebrate your quests.</p>
      </section>

      <section className="card">
        <h2>Members</h2>
        <ul className="roster">
          {members.map((m) => (
            <li key={m.profiles?.id}>
              <span>
                {m.profiles?.display_name}
                {m.role === "owner" && <span className="muted"> · owner</span>}
              </span>
              <span>{Number(m.profiles?.level ?? 3.5).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </section>

      <form action={signOut}>
        <button type="submit" className="secondary">Sign out</button>
      </form>
    </>
  );
}

async function InviteQr({ code, name }: { code: string; name: string }) {
  const url = await joinInviteUrl(code);
  const qr = await qrDataUrl(url);
  // eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL
  return <img className="qr" src={qr} alt={`QR code: scan to join ${name}`} width={220} height={220} />;
}
