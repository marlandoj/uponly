// Pixel-art sprites in public/img (512px webp), matched to rewards and
// chores by keyword. Purely decorative: callers fall back to their plain
// layout when nothing matches.

export const SPRITES = {
  "reward-burrito": "/img/reward-burrito.webp",
  "reward-pizza": "/img/reward-pizza.webp",
  "reward-burger": "/img/reward-burger.webp",
  "reward-sundae": "/img/reward-sundae.webp",
  "chore-dishes": "/img/chore-dishes.webp",
  "chore-laundry": "/img/chore-laundry.webp",
  "chore-trash": "/img/chore-trash.webp",
  "chore-vacuum": "/img/chore-vacuum.webp",
  "chore-bedroom": "/img/chore-bedroom.webp",
} as const;

export type SpriteKey = keyof typeof SPRITES;
export type SpriteKind = "reward" | "chore";

// First match wins, so order matters ("bed linens" is laundry, not bedroom).
const KEYWORDS: Record<SpriteKind, [string[], SpriteKey][]> = {
  reward: [
    [["burrito"], "reward-burrito"],
    [["pizza"], "reward-pizza"],
    [["burger"], "reward-burger"],
    [["sundae", "ice cream"], "reward-sundae"],
  ],
  chore: [
    [["dish"], "chore-dishes"],
    [["laundry"], "chore-laundry"],
    [["trash"], "chore-trash"],
    [["vacuum", "floor sweep"], "chore-vacuum"],
    [["bed", "room reset"], "chore-bedroom"],
  ],
};

/** Sprite path for a reward name or quest title, or null when nothing matches. */
export function resolveSprite(kind: SpriteKind, name: string | null | undefined): string | null {
  if (!name) return null;
  const text = name.toLowerCase();
  for (const [words, key] of KEYWORDS[kind]) {
    if (words.some((w) => text.includes(w))) return SPRITES[key];
  }
  return null;
}
