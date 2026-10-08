import { beforeEach, describe, expect, it, vi } from "vitest";

// approveRun talks to approve_run through the caller's Supabase session; stub
// the client so we can see exactly what reaches the RPC.
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));
vi.mock("@/lib/rewards", () => ({ earnRewardsForRun: vi.fn(async () => []), supabaseRewardStore: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { approveRun } = await import("./actions");

const RUN = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  rpc.mockReset();
  rpc.mockReturnValue({
    single: async () => ({ data: { id: RUN, user_id: "u", circle_id: "c", quest_key: "q" }, error: null }),
  });
});

describe("approveRun: structured rejection", () => {
  it("a redo with no note never reaches the RPC", async () => {
    for (const reason of [null, "", "   ", undefined]) {
      const res = await approveRun(RUN, false, reason);
      expect(res.error).toMatch(/what to fix/i);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("a redo note over 300 chars is refused", async () => {
    expect((await approveRun(RUN, false, "x".repeat(301))).error).toMatch(/300/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes the trimmed note through as p_reason", async () => {
    expect(await approveRun(RUN, false, "  Not finished — towels on the floor ")).toEqual({ error: null, rewards: [] });
    expect(rpc).toHaveBeenCalledWith("approve_run", {
      p_run_id: RUN,
      p_approve: false,
      p_reason: "Not finished — towels on the floor",
    });
  });

  it("approving needs no note and sends p_reason null", async () => {
    expect((await approveRun(RUN, true)).error).toBeNull();
    expect(rpc).toHaveBeenCalledWith("approve_run", { p_run_id: RUN, p_approve: true, p_reason: null });
  });

  it("surfaces the RPC's error (e.g. the server-side reason check)", async () => {
    rpc.mockReturnValue({ single: async () => ({ data: null, error: { message: "tell them what to fix (1–300 characters)" } }) });
    expect((await approveRun(RUN, false, "Wrong spot")).error).toBe("tell them what to fix (1–300 characters)");
  });

  it("a kid's approval is refused by the RPC's parent check", async () => {
    rpc.mockReturnValue({
      single: async () => ({ data: null, error: { code: "42501", message: "only a parent can approve a quest" } }),
    });
    expect(await approveRun(RUN, true)).toEqual({ error: "only a parent can approve a quest", rewards: [] });
  });
});
