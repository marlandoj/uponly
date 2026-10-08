// Pixel-art loot sprites in public/img (512px webp). Kept apart from the
// food/chore sprite helper on the aesthetic branch so the two merge cleanly.
// Purely decorative: null means "no sprite", and callers keep their plain layout.

export const LOOT_SPRITES = {
  coin: "/img/loot-vbucks.webp",
  gem: "/img/loot-robux.webp",
  giftcard: "/img/loot-giftcard.webp",
} as const;

export type LootSprite = (typeof LOOT_SPRITES)[keyof typeof LOOT_SPRITES];

// First match wins: the name is more specific than the game ("Robux gift card"
// on an 'Other' reward is still a gem).
const BY_NAME: [string[], LootSprite][] = [
  [["v-bucks", "vbucks", "v bucks"], LOOT_SPRITES.coin],
  [["robux"], LOOT_SPRITES.gem],
  [["minecoin"], LOOT_SPRITES.coin],
  [["gift"], LOOT_SPRITES.giftcard],
];

const BY_GAME: Record<string, LootSprite> = {
  Fortnite: LOOT_SPRITES.coin,
  Roblox: LOOT_SPRITES.gem,
  Minecraft: LOOT_SPRITES.coin,
};

/** Sprite for a game credit reward; food (and anything else) gets null. */
export function resolveLootSprite(reward: {
  kind: string;
  game?: string | null;
  name?: string | null;
}): LootSprite | null {
  if (reward.kind !== "game_credit") return null;
  const text = (reward.name ?? "").toLowerCase();
  for (const [words, sprite] of BY_NAME) {
    if (words.some((w) => text.includes(w))) return sprite;
  }
  return (reward.game && BY_GAME[reward.game]) || LOOT_SPRITES.giftcard;
}
