import type { SupabaseClient } from "@supabase/supabase-js";
import { getFortniteShop, type ShopItem } from "@/lib/fortniteShop";
import { vbucksToCents } from "@/lib/gameRewards";
import type { Game } from "@/lib/rewards";

// Loot catalog research (game_catalog, 0011). When a gamer saves the games they
// play, we cache what loot for those games costs: today's Fortnite shop (the
// existing fortnite-api.com fetch) plus curated currency packs. The GameMaster's
// loot picker reads it back. DISPLAY ONLY — nothing is bought; a picked item
// becomes an ordinary game_credit reward fulfilled as a (mock) gift card.

/** Must match the game_catalog checks in 0011_loot_catalog.sql. */
export type CatalogItemKind = "currency" | "dlc" | "drop";
export type CatalogSource = "fortnite-api" | "curated";

export type CatalogDetails = {
  image_url?: string;
  vbucks?: number;
  type?: string;
  denomination?: number;
  currency?: string;
};

export type CatalogItemInput = {
  game: Game;
  item_name: string;
  item_kind: CatalogItemKind;
  usd_value: number;
  details: CatalogDetails;
  source: CatalogSource;
};

/** usd_value is numeric in Postgres and may arrive as a string: Number() it at read sites. */
export type CatalogRow = CatalogItemInput & { id: string; fetched_at: string };

/** Pure: today's Fortnite shop → catalog rows, valued as the V-Bucks gift card that covers them. */
export function shopItemsToCatalogItems(items: ShopItem[]): CatalogItemInput[] {
  return items.map((item) => ({
    game: "Fortnite",
    item_name: item.name,
    item_kind: "drop",
    usd_value: vbucksToCents(item.vbucks) / 100,
    details: { image_url: item.image, vbucks: item.vbucks, type: item.type },
    source: "fortnite-api",
  }));
}

const currencyPack = (game: Game, amount: number, currency: string, usd: number): CatalogItemInput => ({
  game,
  item_name: `${amount.toLocaleString("en-US")} ${currency}`,
  item_kind: "currency",
  usd_value: usd,
  details: { currency, denomination: amount },
  source: "curated",
});

// USD list prices, matching GAME_CREDIT_TEMPLATES in lib/gameRewards.ts.
const CURATED: Partial<Record<Game, CatalogItemInput[]>> = {
  Roblox: [
    currencyPack("Roblox", 400, "Robux", 4.99),
    currencyPack("Roblox", 800, "Robux", 9.99),
    currencyPack("Roblox", 1700, "Robux", 19.99),
  ],
  Minecraft: [currencyPack("Minecraft", 3500, "Minecoins", 19.99)],
};

/** Pure: curated currency packs for the given games (Fortnite comes from the shop; Other has none). */
export function curatedCatalogItems(games: Game[]): CatalogItemInput[] {
  return games.flatMap((g) => CURATED[g] ?? []);
}

/** Pure: the reward description a picked catalog item gets. */
export function catalogItemDescription(item: Pick<CatalogItemInput, "game" | "item_kind" | "details">): string {
  if (item.item_kind === "drop") return `${item.game} shop drop`;
  if (item.item_kind === "currency") return `${item.game} game credit gift card`;
  return `${item.game} DLC drop`;
}

/**
 * Refreshes game_catalog for the given games via upsert_game_catalog. Never
 * throws: research is best-effort and must not fail the caller's save.
 */
export async function researchCatalogForGames(
  supabase: SupabaseClient,
  games: Game[],
  shopOpts?: { fetchImpl?: typeof fetch },
): Promise<{ inserted: number; source: string }> {
  const none = { inserted: 0, source: "none" };
  try {
    if (games.length === 0) return none;

    const items: CatalogItemInput[] = [];
    const sources: CatalogSource[] = [];

    if (games.includes("Fortnite")) {
      try {
        const shop = await getFortniteShop(shopOpts ?? {});
        if (shop.ok) {
          items.push(...shopItemsToCatalogItems(shop.items));
          sources.push("fortnite-api");
        } else {
          console.warn("researchCatalogForGames: Fortnite shop unavailable:", shop.reason);
        }
      } catch (e) {
        console.warn("researchCatalogForGames: Fortnite shop failed:", e);
      }
    }

    const curated = curatedCatalogItems(games);
    if (curated.length > 0) {
      items.push(...curated);
      sources.push("curated");
    }

    if (items.length === 0) return none;

    const { data, error } = await supabase.rpc("upsert_game_catalog", { p_items: items });
    if (error) {
      console.warn("researchCatalogForGames: upsert_game_catalog failed:", error.message ?? error);
      return none;
    }
    return { inserted: typeof data === "number" ? data : items.length, source: sources.join("+") };
  } catch (e) {
    console.warn("researchCatalogForGames:", e);
    return none;
  }
}
