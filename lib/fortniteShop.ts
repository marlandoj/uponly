// Today's Fortnite item shop, read from the community fortnite-api.com mirror
// (GET https://fortnite-api.com/v2/shop, no key). DISPLAY ONLY: GameMasters browse
// it to name a chore reward after an item. Nothing here (or anywhere) buys an
// item — Epic has no purchasing API — the gamer gets a gift card for V-Bucks.
//
// Response shape (as of 2026-10): { status, data: { date, vbuckIcon, entries[] } }
// where each entry has offerId, regularPrice / finalPrice (V-Bucks), an optional
// bundle { name, image }, newDisplayAsset.renderImages[].image, and one of
// brItems[] (outfits, emotes, shoes…, name + images.icon), cars[] (name +
// images.small), instruments[], or tracks[] (Jam Tracks: title + albumArt).
// Jam Tracks are skipped — they're music, not loot.

export const SHOP_URL = "https://fortnite-api.com/v2/shop";
export const SHOP_TIMEOUT_MS = 8_000;
export const SHOP_CACHE_MS = 60 * 60 * 1000;
export const SHOP_MAX_ITEMS = 48;

export type ShopItem = {
  id: string;
  name: string;
  image: string;
  /** What it costs in the shop today (finalPrice), in V-Bucks. */
  vbucks: number;
  /** Shown struck through when the item is on sale. */
  regularVbucks: number;
  type: string;
};

export type ShopResult = { ok: true; items: ShopItem[]; date: string | null } | { ok: false; reason: string };

type Named = { name?: unknown; images?: Record<string, unknown>; type?: { displayValue?: unknown } };
type Entry = {
  offerId?: unknown;
  regularPrice?: unknown;
  finalPrice?: unknown;
  bundle?: { name?: unknown; image?: unknown } | null;
  newDisplayAsset?: { renderImages?: { image?: unknown }[] } | null;
  brItems?: Named[];
  cars?: Named[];
  instruments?: Named[];
};

const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const httpsUrl = (v: unknown) => {
  const s = str(v);
  return s && s.startsWith("https://") ? s : null;
};

/** Pure: raw /v2/shop JSON → displayable items (deduped by name, capped). */
export function parseShop(json: unknown, max = SHOP_MAX_ITEMS): ShopResult {
  const data = (json as { data?: { entries?: unknown; date?: unknown } } | null)?.data;
  if (!data || !Array.isArray(data.entries)) return { ok: false, reason: "unexpected shop response" };

  const items: ShopItem[] = [];
  const seen = new Set<string>();
  for (const e of data.entries as Entry[]) {
    if (items.length >= max) break;
    const first = e.brItems?.[0] ?? e.cars?.[0] ?? e.instruments?.[0];
    if (!first) continue; // Jam Tracks and anything unknown
    const name = str(e.bundle?.name) ?? str(first.name);
    const image =
      httpsUrl(e.bundle?.image) ??
      httpsUrl(e.newDisplayAsset?.renderImages?.[0]?.image) ??
      httpsUrl(first.images?.icon) ??
      httpsUrl(first.images?.small) ??
      httpsUrl(first.images?.smallIcon);
    const vbucks = typeof e.finalPrice === "number" ? e.finalPrice : NaN;
    if (!name || !image || !Number.isInteger(vbucks) || vbucks <= 0 || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    items.push({
      id: str(e.offerId) ?? name,
      name,
      image,
      vbucks,
      regularVbucks: typeof e.regularPrice === "number" ? e.regularPrice : vbucks,
      type: e.bundle ? "Bundle" : (str(first.type?.displayValue) ?? "Item"),
    });
  }
  if (items.length === 0) return { ok: false, reason: "shop is empty" };
  return { ok: true, items, date: str(data.date) };
}

// One-hour in-memory cache, per server process. In `next dev` and on a single
// long-lived `next start` this saves a 700 KB fetch per page view; on
// serverless each cold instance refetches, which is fine for a display-only page.
// Failures are not cached, so the next view retries.
const cache = new Map<string, { at: number; result: Extract<ShopResult, { ok: true }> }>();

export function clearShopCache() {
  cache.clear();
}

export async function getFortniteShop(
  opts: { fetchImpl?: typeof fetch; now?: () => number; timeoutMs?: number } = {},
): Promise<ShopResult> {
  const { fetchImpl = fetch, now = Date.now, timeoutMs = SHOP_TIMEOUT_MS } = opts;
  const hit = cache.get(SHOP_URL);
  if (hit && now() - hit.at < SHOP_CACHE_MS) return hit.result;

  try {
    const res = await fetchImpl(SHOP_URL, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if (!res.ok) return { ok: false, reason: `shop returned ${res.status}` };
    const result = parseShop(await res.json());
    if (result.ok) cache.set(SHOP_URL, { at: now(), result });
    return result;
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    console.warn("getFortniteShop:", e);
    return { ok: false, reason: timedOut ? "shop timed out" : "shop unreachable" };
  }
}
