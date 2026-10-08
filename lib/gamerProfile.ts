import { GAMES, isGame, type Game } from "@/lib/rewards";

// Gamer tag + games a gamer plays (profiles.gamer_tag / games, 0008). A label for
// the household only — no gamer-tag → account lookup exists, and none is made.

/** Games offered as checkboxes on the profile form ('Other' stays DB-only). */
export const PROFILE_GAMES: Game[] = GAMES.filter((g) => g !== "Other");

export type GamerProfileInput = { gamerTag: string | null; games: Game[] };

/** Mirrors set_gamer_profile: empty tag clears it; games de-duplicated, known only. */
export function parseGamerProfileForm(form: {
  gamerTag?: unknown;
  games?: unknown[];
}): { ok: true; value: GamerProfileInput } | { ok: false; error: string } {
  const tag = String(form.gamerTag ?? "").trim();
  if (tag.length > 32) return { ok: false, error: "Gamer tag must be 32 characters or less" };
  const games: Game[] = [];
  for (const g of form.games ?? []) {
    if (!isGame(g)) return { ok: false, error: "Pick games from the list" };
    if (!games.includes(g)) games.push(g);
  }
  return { ok: true, value: { gamerTag: tag === "" ? null : tag, games: games.sort() } };
}
