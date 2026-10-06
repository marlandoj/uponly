import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyCircle } from "@/lib/circle";
import { joinInviteUrl } from "@/lib/joinInvite";
import { qrDataUrl } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";
import { BossBar } from "./Celebrate";
import { signOut } from "./login/actions";

type Member = {
  role: string;
  profiles: { id: string; display_name: string; level: number; xp: number } | null;
};

export default async function Home() {
  const circle = await getMyCircle();
  if (!circle) redirect("/circle");

  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from("circle_members")
    .select("role, profiles(id, display_name, level, xp)")
    .eq("circle_id", circle.id)
    .order("joined_at")
    .overrideTypes<Member[], { merge: false }>();
  if (error) throw error;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = members.find((m) => m.profiles?.id === user?.id)?.profiles;

  return (
    <>
      <h1>{circle.name}</h1>

      <Link href="/quest" className="button">Start a quest</Link>
      <Link href="/r" className="button secondary">Celebrate a circle-mate&apos;s quest</Link>
      <Link href="/leaderboard" className="button secondary">Leaderboard</Link>

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
