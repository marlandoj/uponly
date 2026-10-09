import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getProvider,
  isFulfillmentKind,
  PROVIDERS,
  type FulfillmentKind,
  type ProviderRegistry,
} from "@/lib/fulfillment";
import { mockEtaMinutes } from "@/lib/fulfillment/mock-doordash";
import { QUESTS } from "@/lib/quests";

// Server-side reward earn flow. Runs in the photo route right after
// complete_quest succeeds; it must never fail that request. All DB writes are
// user-context RPCs from 0007_rewards.sql / 0008_game_rewards.sql. Food and game
// credit rewards share the flow (it keys off fulfillment, not kind); fulfillment is mock.

export type EarningStatus = "earned" | "fulfilled";

/** Must match the rewards.kind check in 0008_game_rewards.sql. */
export const REWARD_KINDS = ["food", "game_credit"] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];

/** Must match the rewards.game / profiles.games checks in 0008_game_rewards.sql. */
export const GAMES = ["Fortnite", "Roblox", "Minecraft", "Other"] as const;
export type Game = (typeof GAMES)[number];

export const isRewardKind = (v: unknown): v is RewardKind =>
  typeof v === "string" && (REWARD_KINDS as readonly string[]).includes(v);
export const isGame = (v: unknown): v is Game => typeof v === "string" && (GAMES as readonly string[]).includes(v);

export type Reward = {
  id: string;
  circle_id: string;
  name: string;
  description: string;
  kind: RewardKind;
  game: Game | null;
  value_cents: number | null;
  fulfillment: FulfillmentKind;
  quest_key: string | null;
};

export type RewardEarning = {
  id: string;
  reward_id: string;
  profile_id: string;
  quest_run_id: string;
  status: EarningStatus;
  earned_at: string;
  fulfilled_at: string | null;
  fulfillment_ref: string | null;
};

/** What the gamer's reward drop shows for one earning. */
export type EarnedReward = {
  earningId: string;
  rewardId: string;
  name: string;
  description: string;
  kind: RewardKind;
  game: Game | null;
  fulfillment: FulfillmentKind;
  status: EarningStatus;
  ref: string | null;
  etaMinutes: number | null;
  displayText: string;
};

export type RunForRewards = { id: string; user_id: string; circle_id: string; quest_key: string };

export const REWARD_COLUMNS = "id, circle_id, name, description, kind, game, value_cents, fulfillment, quest_key";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** A reward with no quest_key applies to every quest; otherwise keys must match. */
export function isRewardForQuest(reward: Pick<Reward, "quest_key">, questKey: string): boolean {
  return reward.quest_key === null || reward.quest_key === questKey;
}

/** Rewards a completed run earns: same squad, matching (or any-quest) key. */
export function eligibleRewards<R extends Pick<Reward, "circle_id" | "quest_key">>(
  rewards: R[],
  run: Pick<RunForRewards, "circle_id" | "quest_key">,
): R[] {
  return rewards.filter((r) => r.circle_id === run.circle_id && isRewardForQuest(r, run.quest_key));
}

/** Auto providers fulfill on earn; manual waits for the GameMaster. */
export function isAutoFulfilled(kind: FulfillmentKind, registry: ProviderRegistry = PROVIDERS): boolean {
  return getProvider(kind, registry) !== null;
}

/** earned → fulfilled (ref required); fulfilled stays as-is. Mirrors mark_earning_fulfilled. */
export function fulfillEarning<E extends Pick<RewardEarning, "status" | "fulfilled_at" | "fulfillment_ref">>(
  earning: E,
  ref: string,
  now: Date = new Date(),
): E {
  if (earning.status === "fulfilled") return earning;
  const clean = ref.trim();
  if (!clean) throw new Error("fulfillment ref required");
  return { ...earning, status: "fulfilled", fulfilled_at: now.toISOString(), fulfillment_ref: clean };
}

/** Gamer-facing line for an earning, rebuildable from what's stored. */
export function describeEarning(
  kind: FulfillmentKind,
  status: EarningStatus,
  ref: string | null,
): { displayText: string; etaMinutes: number | null } {
  if (status !== "fulfilled" || !ref) {
    return kind === "manual"
      ? { displayText: "Your GameMaster will fulfill this", etaMinutes: null }
      : { displayText: "Unlocking… your GameMaster can fulfill this", etaMinutes: null };
  }
  if (kind === "mock-tremendous") return { displayText: `Gift code ${ref} (mock)`, etaMinutes: null };
  if (kind === "mock-doordash") return { displayText: "Order confirmed", etaMinutes: mockEtaMinutes(ref) };
  return { displayText: "Fulfilled by your GameMaster", etaMinutes: null };
}

/** "$12.50" → 1250. Empty → null. Anything else invalid → undefined. */
export function dollarsToCents(input: string): number | null | undefined {
  const s = input.trim().replace(/^\$/, "");
  if (s === "") return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return undefined;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export type RewardInput = {
  name: string;
  description: string;
  valueCents: number | null;
  fulfillment: FulfillmentKind;
  questKey: string | null;
  kind: RewardKind;
  game: Game | null;
};

/**
 * Validates the GameMaster's "new reward" form; quest must be in the catalog.
 * kind defaults to food; a game credit must name its game.
 */
export function parseRewardForm(form: {
  name?: unknown;
  description?: unknown;
  value?: unknown;
  fulfillment?: unknown;
  questKey?: unknown;
  kind?: unknown;
  game?: unknown;
}): { ok: true; value: RewardInput } | { ok: false; error: string } {
  const name = String(form.name ?? "").trim();
  if (name.length < 1 || name.length > 60) return { ok: false, error: "Name must be 1-60 characters" };
  const description = String(form.description ?? "").trim();
  if (description.length > 280) return { ok: false, error: "Description must be 280 characters or less" };
  const valueCents = dollarsToCents(String(form.value ?? ""));
  if (valueCents === undefined) return { ok: false, error: "Value must be a dollar amount like 12.50" };
  if (!isFulfillmentKind(form.fulfillment)) return { ok: false, error: "Pick how the reward is fulfilled" };
  const rawKey = String(form.questKey ?? "").trim();
  const questKey = rawKey === "" ? null : rawKey;
  if (questKey !== null && !QUESTS.some((q) => q.key === questKey)) {
    return { ok: false, error: "Pick a quest from the list" };
  }
  const rawKind = String(form.kind ?? "").trim();
  const kind = rawKind === "" ? "food" : rawKind;
  if (!isRewardKind(kind)) return { ok: false, error: "Pick a reward type" };
  const rawGame = String(form.game ?? "").trim();
  const game = rawGame === "" ? null : rawGame;
  if (game !== null && !isGame(game)) return { ok: false, error: "Pick a game from the list" };
  if (kind === "game_credit" && game === null) return { ok: false, error: "Game loot needs a game" };
  return { ok: true, value: { name, description, valueCents, fulfillment: form.fulfillment, questKey, kind, game } };
}

/** Catalog title for a reward's quest_key ("Any quest" when unattached). */
export function questLabel(questKey: string | null): string {
  if (questKey === null) return "Any quest";
  const q = QUESTS.find((x) => x.key === questKey);
  return q ? `${q.emoji} ${q.title}` : questKey;
}

// ---------------------------------------------------------------------------
// Earn flow
// ---------------------------------------------------------------------------

/** The three DB operations the earn flow needs; swapped for a fake in tests. */
export type RewardStore = {
  listCircleRewards(circleId: string): Promise<Reward[]>;
  recordEarning(rewardId: string, runId: string): Promise<RewardEarning>;
  markFulfilled(earningId: string, ref: string): Promise<RewardEarning>;
};

export function supabaseRewardStore(supabase: SupabaseClient): RewardStore {
  return {
    async listCircleRewards(circleId) {
      const { data, error } = await supabase
        .from("rewards")
        .select(REWARD_COLUMNS)
        .eq("circle_id", circleId)
        .order("created_at")
        .overrideTypes<Reward[], { merge: false }>();
      if (error) throw error;
      return data;
    },
    async recordEarning(rewardId, runId) {
      const { data, error } = await supabase
        .rpc("record_reward_earning", { p_reward_id: rewardId, p_run_id: runId })
        .single<RewardEarning>();
      if (error) throw error;
      return data;
    },
    async markFulfilled(earningId, ref) {
      const { data, error } = await supabase
        .rpc("mark_earning_fulfilled", { p_earning_id: earningId, p_fulfillment_ref: ref })
        .single<RewardEarning>();
      if (error) throw error;
      return data;
    },
  };
}

/**
 * Records an earning for every eligible reward, auto-fulfills via the mock
 * providers, and returns what to show. Never throws: each reward is
 * independent and failures are logged (the quest is already completed).
 */
export async function earnRewardsForRun(
  store: RewardStore,
  run: RunForRewards,
  registry: ProviderRegistry = PROVIDERS,
): Promise<EarnedReward[]> {
  let rewards: Reward[];
  try {
    rewards = eligibleRewards(await store.listCircleRewards(run.circle_id), run);
  } catch (e) {
    console.warn("earnRewardsForRun: could not load rewards:", e);
    return [];
  }

  const earned: EarnedReward[] = [];
  for (const reward of rewards) {
    let earning: RewardEarning;
    try {
      earning = await store.recordEarning(reward.id, run.id);
    } catch (e) {
      console.warn(`earnRewardsForRun: could not record reward ${reward.id}:`, e);
      continue;
    }

    let eta: number | null = null;
    let text: string | null = null;
    const provider = getProvider(reward.fulfillment, registry);
    if (provider && earning.status === "earned") {
      try {
        const result = await provider.fulfill(
          {
            id: reward.id,
            name: reward.name,
            description: reward.description,
            valueCents: reward.value_cents,
            fulfillment: reward.fulfillment,
          },
          { id: earning.id, profileId: earning.profile_id, questRunId: earning.quest_run_id },
        );
        earning = await store.markFulfilled(earning.id, result.ref);
        eta = result.etaMinutes ?? null;
        text = result.displayText;
      } catch (e) {
        // Stays 'earned'; it shows up in the GameMaster's queue to fulfill by hand.
        console.warn(`earnRewardsForRun: fulfillment failed for earning ${earning.id}:`, e);
      }
    }

    const shown = describeEarning(reward.fulfillment, earning.status, earning.fulfillment_ref);
    earned.push({
      earningId: earning.id,
      rewardId: reward.id,
      name: reward.name,
      description: reward.description,
      kind: reward.kind,
      game: reward.game,
      fulfillment: reward.fulfillment,
      status: earning.status,
      ref: earning.fulfillment_ref,
      etaMinutes: eta ?? shown.etaMinutes,
      displayText: text ?? shown.displayText,
    });
  }
  return earned;
}
