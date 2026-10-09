import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub Supabase and next/navigation so we can see where a save lands.
const rpc = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`);
});
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));
vi.mock("@/lib/catalogResearch", () => ({ researchCatalogForGames: vi.fn(async () => {}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

const { saveGamerProfile } = await import("./actions");

const form = (tag: string) => {
  const f = new FormData();
  f.set("gamer_tag", tag);
  return f;
};

beforeEach(() => {
  rpc.mockReset();
  redirect.mockClear();
});

describe("saveGamerProfile", () => {
  it("returns to the profile with a saved confirmation", async () => {
    rpc.mockResolvedValue({ error: null });
    await expect(saveGamerProfile(form("NinjaKid42"))).rejects.toThrow("REDIRECT /profile?saved=1");
  });

  it("surfaces an RPC error instead of confirming", async () => {
    rpc.mockResolvedValue({ error: { message: "nope" } });
    await expect(saveGamerProfile(form("NinjaKid42"))).rejects.toThrow("REDIRECT /profile?error=nope");
  });
});
