import { redirect } from "next/navigation";
import { getMyCircle } from "@/lib/circle";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <>
      <h1>{circle.name}</h1>

      <section className="card">
        <h2>Invite to your circle</h2>
        <p className="code">{circle.join_code}</p>
        <p className="muted">Share this code so housemates can join and celebrate your quests.</p>
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
