import { catalogItemDescription, type CatalogRow } from "@/lib/catalogResearch";
import { choreSizeMeta, sortByCloseness, suggestedCentsFor, type ChoreSize } from "@/lib/choreTiers";
import { formatCents, type Game } from "@/lib/rewards";
import { createClient } from "@/lib/supabase/server";
import { createReward } from "../actions";
import { RewardFields } from "../GameLootTemplates";

/**
 * Researched loot (game_catalog, 0011) for the kid's games, closest to the
 * chore's suggested value first. One tap adds it as a game_credit reward
 * fulfilled as a (mock) gift card — never an in-game purchase. Renders nothing
 * if the catalog can't be read or has no rows for these games.
 */
export default async function LootPicker({ games, size, tag }: { games: Game[]; size: ChoreSize; tag: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_catalog")
    .select("id, game, item_name, item_kind, usd_value, details, fetched_at")
    .in("game", games)
    .overrideTypes<Omit<CatalogRow, "source">[], { merge: false }>();
  if (error) return null;

  const rows = data.map((r) => ({ ...r, usd_value: Number(r.usd_value), details: r.details ?? {} }));
  const target = suggestedCentsFor(size);
  const groups = games
    .map((game) => ({ game, items: sortByCloseness(rows.filter((r) => r.game === game), target) }))
    .filter((g) => g.items.length > 0);
  if (groups.length === 0) return null;
  const meta = choreSizeMeta(size);

  return (
    <section className="card" id="loot-picker">
      <h2>🎯 Available loot for {tag || "your kid"}</h2>
      <p className="muted">
        Closest to a {meta.label} chore (~{formatCents(meta.suggestedCents)}) first — one tap adds it as a
        gift-card reward.
      </p>
      {groups.map(({ game, items }) => (
        <div key={game}>
          <h3>{game}</h3>
          <ul className="loot-grid">
            {items.map((row) => {
              const usd = row.usd_value;
              // Any signed-in user can write the catalog: only show https art.
              const image = row.details.image_url?.startsWith("https://") ? row.details.image_url : null;
              return (
                <li key={row.id}>
                  <form action={createReward} className="loot-tile">
                    <RewardFields
                      from="/rewards/new"
                      input={{
                        name: row.item_name.slice(0, 60),
                        description: catalogItemDescription(row),
                        valueCents: Number.isFinite(usd) ? Math.round(usd * 100) : null,
                        fulfillment: "mock-tremendous",
                        kind: "game_credit",
                        game: row.game,
                      }}
                    />
                    {image && (
                      // eslint-disable-next-line @next/next/no-img-element -- remote shop art, display only
                      <img src={image} alt="" width={128} height={128} loading="lazy" className="shop-art" />
                    )}
                    <strong>{row.item_name}</strong>
                    <span className="muted">{`${row.game} · $${usd.toFixed(2)}`}</span>
                    <button type="submit">Add</button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
