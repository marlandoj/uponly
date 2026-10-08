import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearShopCache, getFortniteShop, parseShop, SHOP_CACHE_MS } from "./fortniteShop";

vi.spyOn(console, "warn").mockImplementation(() => {});

// Trimmed from a real GET https://fortnite-api.com/v2/shop response (2026-10-08).
const IMG = "https://fortnite-api.com/images/cosmetics";
const SHOP = {
  status: 200,
  data: {
    date: "2026-10-08T00:00:00Z",
    entries: [
      {
        offerId: "v2:/bear",
        regularPrice: 300,
        finalPrice: 300,
        brItems: [{ name: "Bear Brained", type: { displayValue: "Back Bling" }, images: { smallIcon: `${IMG}/bear/smallicon.png`, icon: `${IMG}/bear/icon.png` } }],
      },
      {
        offerId: "v2:/wheel",
        regularPrice: 700,
        finalPrice: 700,
        bundle: { name: "Anti-Magic Wheel", image: `${IMG}/wheel/renderimage_0.png` },
        newDisplayAsset: { renderImages: [{ image: `${IMG}/wheel/renderimage_0.png` }] },
        cars: [{ name: "Anti-Magic", type: { displayValue: "Wheel" }, images: { small: `${IMG}/wheel/small.png` } }],
      },
      {
        offerId: "v2:/track",
        regularPrice: 500,
        finalPrice: 500,
        tracks: [{ title: "Hey Brother", albumArt: "https://cdn.fortnite-api.com/tracks/x.jpg" }],
      },
      {
        offerId: "v2:/gtr",
        regularPrice: 400,
        finalPrice: 400,
        cars: [{ name: "Nissan GT-R Nismo", type: { displayValue: "Wheel" }, images: { small: `${IMG}/gtr/small.png` } }],
      },
      {
        offerId: "v2:/skull",
        regularPrice: 3600,
        finalPrice: 2300,
        bundle: { name: "Skull Trooper Bundle", image: `${IMG}/skull/renderimage_0.png` },
        brItems: [{ name: "Skull Trooper ", type: { displayValue: "Outfit" }, images: { icon: `${IMG}/skull/icon.png` } }],
      },
      // duplicate name (same item in two sections) and junk entries are dropped
      { offerId: "v2:/bear2", regularPrice: 300, finalPrice: 300, brItems: [{ name: "Bear Brained", images: { icon: `${IMG}/bear/icon.png` } }] },
      { offerId: "v2:/noimg", regularPrice: 100, finalPrice: 100, brItems: [{ name: "Ghost", images: {} }] },
      { offerId: "v2:/free", regularPrice: 0, finalPrice: 0, brItems: [{ name: "Freebie", images: { icon: `${IMG}/f.png` } }] },
      { offerId: "v2:/http", regularPrice: 200, finalPrice: 200, brItems: [{ name: "Plain", images: { icon: "http://evil.example/x.png" } }] },
    ],
  },
};

describe("parseShop", () => {
  it("maps cosmetics, bundles and cars; skips Jam Tracks, dupes, imageless, free and non-https", () => {
    const r = parseShop(SHOP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.items.map((i) => i.name)).toEqual([
      "Bear Brained",
      "Anti-Magic Wheel",
      "Nissan GT-R Nismo",
      "Skull Trooper Bundle",
    ]);
    expect(r.items[0]).toEqual({
      id: "v2:/bear",
      name: "Bear Brained",
      image: `${IMG}/bear/icon.png`,
      vbucks: 300,
      regularVbucks: 300,
      type: "Back Bling",
    });
    expect(r.items[1]).toMatchObject({ image: `${IMG}/wheel/renderimage_0.png`, type: "Bundle" });
    expect(r.items[2]).toMatchObject({ image: `${IMG}/gtr/small.png`, type: "Wheel" });
    expect(r.items[3]).toMatchObject({ vbucks: 2300, regularVbucks: 3600 });
    expect(r.date).toBe("2026-10-08T00:00:00Z");
  });

  it("caps the item count", () => {
    const r = parseShop(SHOP, 2);
    expect(r.ok && r.items).toHaveLength(2);
  });

  it("fails on an unexpected or empty response", () => {
    expect(parseShop(null).ok).toBe(false);
    expect(parseShop({ status: 404, error: "nope" }).ok).toBe(false);
    expect(parseShop({ data: { entries: [] } })).toEqual({ ok: false, reason: "shop is empty" });
  });
});

describe("getFortniteShop", () => {
  beforeEach(() => clearShopCache());

  const ok = () => vi.fn(async () => new Response(JSON.stringify(SHOP), { status: 200 })) as unknown as typeof fetch;

  it("fetches once and serves the cache for an hour", async () => {
    const fetchImpl = ok();
    let t = 1_000_000;
    const now = () => t;
    expect((await getFortniteShop({ fetchImpl, now })).ok).toBe(true);
    t += SHOP_CACHE_MS - 1;
    await getFortniteShop({ fetchImpl, now });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t += 2;
    await getFortniteShop({ fetchImpl, now });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("falls back on HTTP errors without caching the failure", async () => {
    const bad = vi.fn(async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    expect(await getFortniteShop({ fetchImpl: bad })).toEqual({ ok: false, reason: "shop returned 503" });
    const good = ok();
    expect((await getFortniteShop({ fetchImpl: good })).ok).toBe(true);
  });

  it("falls back when the shop is unreachable", async () => {
    const down = vi.fn(async () => Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch;
    expect(await getFortniteShop({ fetchImpl: down })).toEqual({ ok: false, reason: "shop unreachable" });
  });

  it("times out slow responses", async () => {
    const hang = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
      })) as unknown as typeof fetch;
    expect(await getFortniteShop({ fetchImpl: hang, timeoutMs: 20 })).toEqual({ ok: false, reason: "shop timed out" });
  });
});
