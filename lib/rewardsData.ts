import { createClient } from "@/lib/supabase/server";
import {
  describeEarning,
  REWARD_COLUMNS,
  type EarnedReward,
  type EarningStatus,
  type Reward,
} from "@/lib/rewards";

// Page reads for rewards, all through the caller's RLS (0007_rewards.sql, 0008_game_rewards.sql).

type EarningRow = {
  id: string;
  reward_id: string;
  status: EarningStatus;
  earned_at: string;
  fulfilled_at: string | null;
  fulfillment_ref: string | null;
  reward: Pick<Reward, "name" | "description" | "kind" | "game" | "fulfillment"> | null;
};

/** Rewards earned by one quest run, shaped for the reward drop. */
export async function getRunRewards(runId: string): Promise<{ rewards: EarnedReward[]; latestEarnedAt: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reward_earnings")
    .select("id, reward_id, status, earned_at, fulfilled_at, fulfillment_ref, reward:rewards(name, description, kind, game, fulfillment)")
    .eq("quest_run_id", runId)
    .order("earned_at")
    .overrideTypes<EarningRow[], { merge: false }>();
  if (error) throw error;

  const rewards = data
    .filter((e) => e.reward)
    .map((e): EarnedReward => {
      const r = e.reward!;
      return {
        earningId: e.id,
        rewardId: e.reward_id,
        name: r.name,
        description: r.description,
        kind: r.kind,
        game: r.game,
        fulfillment: r.fulfillment,
        status: e.status,
        ref: e.fulfillment_ref,
        ...describeEarning(r.fulfillment, e.status, e.fulfillment_ref),
      };
    });
  return { rewards, latestEarnedAt: data.at(-1)?.earned_at ?? null };
}

/** All rewards in the caller's squad, newest first. */
export async function getCircleRewards(circleId: string): Promise<(Reward & { created_at: string })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rewards")
    .select(`${REWARD_COLUMNS}, created_at`)
    .eq("circle_id", circleId)
    .order("created_at", { ascending: false })
    .overrideTypes<(Reward & { created_at: string })[], { merge: false }>();
  if (error) throw error;
  return data;
}

export type QueueEntry = EarningRow & { gamer: { display_name: string } | null };

/** Every earning in the squad (unfulfilled first, then newest). */
export async function getFulfillmentQueue(circleId: string): Promise<QueueEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reward_earnings")
    .select(
      "id, reward_id, status, earned_at, fulfilled_at, fulfillment_ref, " +
        "reward:rewards!inner(name, description, kind, game, fulfillment, circle_id), " +
        "gamer:profiles(display_name)",
    )
    .eq("reward.circle_id", circleId)
    .order("status")
    .order("earned_at", { ascending: false })
    .limit(100)
    .overrideTypes<QueueEntry[], { merge: false }>();
  if (error) throw error;
  return data;
}
