import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  catalogItemDescription,
  curatedCatalogItems,
  researchCatalogForGames,
  shopItemsToCatalogItems,
} from "./catalogResearch";
import { clearShopCache, type ShopItem } from "./fortniteShop";
import { vbucksToCents } from "./gameRewards";

vi.spyOn(console, "warn").mockImplementation(() => {});

const KINDS = ["currency", "dlc", "drop"];
const SOURCES = ["fortnite-api", "curated"];

const SHOP_JSON = {
  data: {
    entries: [
      {
        offerId: "x",
        finalPrice: 800,
        regularPrice: 800,
        brItems: [{ name: "Cool Skin", images: { icon: "https://x/y.png" }, type: { displayValue: "Outfit" } }],
      },
    ],
    date: "2026-10-08",
  },
};

const okFetch = (async () => new Response(JSON.stringify(SHOP_JSON), { status: 200 })) as typeof fetch;
const throwingFetch = (async () => {
  throw new Error("network down");
}) as typeof fetch;

function fakeSupabase(result: { data: unknown; error: unknown }) {
  const calls: { name: string; args: { p_items: Record<string, unknown>[] } }[] = [];
  const client = {
    rpc: async (name: string, args: { p_items: Record<string, unknown>[] }) => {
      calls.push({ name, args });
      return result;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

beforeEach(() => clearShopCache());

describe("shopItemsToCatalogItems", () => {
  it("maps a shop item to a Fortnite drop valued as its V-Bucks gift card", () => {
    const item: ShopItem = {
      id: "o1",
      name: "Big Skin",
      image: "https://img/a.png",
      vbucks: 1000,
      regularVbucks: 1200,
      type: "Outfit",
    };
    const [row] = shopItemsToCatalogItems([item]);
    expect(row).toEqual({
      game: "Fortnite",
      item_name: "Big Skin",
      item_kind: "drop",
      usd_value: 8.99,
      details: { image_url: "https://img/a.png", vbucks: 1000, type: "Outfit" },
      source: "fortnite-api",
    });
    expect(row.usd_value).toBe(vbucksToCents(1000) / 100);
  });
});

describe("curatedCatalogItems", () => {
  it("Roblox → three Robux packs", () => {
    const rows = curatedCatalogItems(["Roblox"]);
    expect(rows.map((r) => [r.item_name, r.usd_value, r.details.denomination])).toEqual([
      ["400 Robux", 4.99, 400],
      ["800 Robux", 9.99, 800],
      ["1,700 Robux", 19.99, 1700],
    ]);
    for (const r of rows) {
      expect(r).toMatchObject({ game: "Roblox", item_kind: "currency", source: "curated" });
      expect(r.details.currency).toBe("Robux");
    }
  });

  it("Minecraft → one Minecoins pack", () => {
    expect(curatedCatalogItems(["Minecraft"])).toEqual([
      {
        game: "Minecraft",
        item_name: "3,500 Minecoins",
        item_kind: "currency",
        usd_value: 19.99,
        details: { currency: "Minecoins", denomination: 3500 },
        source: "curated",
      },
    ]);
  });

  it("Fortnite, Other and no games → nothing", () => {
    expect(curatedCatalogItems(["Fortnite"])).toEqual([]);
    expect(curatedCatalogItems(["Other"])).toEqual([]);
    expect(curatedCatalogItems([])).toEqual([]);
  });
});

describe("catalogItemDescription", () => {
  it("describes each kind", () => {
    expect(catalogItemDescription({ game: "Fortnite", item_kind: "drop", details: {} })).toBe("Fortnite shop drop");
    expect(catalogItemDescription({ game: "Roblox", item_kind: "currency", details: {} })).toBe(
      "Roblox game credit gift card",
    );
    expect(catalogItemDescription({ game: "Minecraft", item_kind: "dlc", details: {} })).toBe("Minecraft DLC drop");
  });
});

describe("researchCatalogForGames", () => {
  it("upserts shop + curated rows and reports both sources", async () => {
    const { client, calls } = fakeSupabase({ data: 5, error: null });
    const result = await researchCatalogForGames(client, ["Fortnite", "Roblox"], { fetchImpl: okFetch });

    expect(result).toEqual({ inserted: 5, source: "fortnite-api+curated" });
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("upsert_game_catalog");
    const items = calls[0].args.p_items;
    expect(Array.isArray(items)).toBe(true);
    expect(items).toHaveLength(4);
    for (const it of items) {
      expect(Object.keys(it).sort()).toEqual(["details", "game", "item_kind", "item_name", "source", "usd_value"]);
      expect(KINDS).toContain(it.item_kind);
      expect(SOURCES).toContain(it.source);
    }
    expect(items[0]).toMatchObject({ item_name: "Cool Skin", usd_value: vbucksToCents(800) / 100 });
  });

  it("never throws when the RPC errors", async () => {
    const { client } = fakeSupabase({ data: null, error: { message: "boom" } });
    await expect(researchCatalogForGames(client, ["Fortnite", "Roblox"], { fetchImpl: okFetch })).resolves.toEqual({
      inserted: 0,
      source: "none",
    });
  });

  it("falls back to curated rows when the shop fetch throws", async () => {
    const { client, calls } = fakeSupabase({ data: 3, error: null });
    const result = await researchCatalogForGames(client, ["Fortnite", "Roblox"], { fetchImpl: throwingFetch });

    expect(result).toEqual({ inserted: 3, source: "curated" });
    expect(calls).toHaveLength(1);
    expect(calls[0].args.p_items.every((i) => i.source === "curated")).toBe(true);
    expect(calls[0].args.p_items).toHaveLength(3);
  });

  it("does nothing for no games", async () => {
    const { client, calls } = fakeSupabase({ data: 5, error: null });
    expect(await researchCatalogForGames(client, [])).toEqual({ inserted: 0, source: "none" });
    expect(calls).toHaveLength(0);
  });

  it("never throws when the client itself throws", async () => {
    const client = {
      rpc: () => {
        throw new Error("kaboom");
      },
    } as unknown as SupabaseClient;
    expect(await researchCatalogForGames(client, ["Roblox"])).toEqual({ inserted: 0, source: "none" });
  });
});
