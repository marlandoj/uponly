// Boss HP bar: total XP chips away at a chain of chore bosses. Pure, derived
// from profiles.xp — XP only goes up, so bosses only ever get defeated.

export const BOSS_HP = 50;

export const BOSSES = [
  "Dust Bunny King",
  "Laundry Hydra",
  "Grease Goblin",
  "Clutter Golem",
  "Sink Kraken",
  "Crumb Wraith",
] as const;

export type BossState = {
  /** Bosses defeated so far. */
  defeated: number;
  /** Name of the boss currently being fought. */
  name: string;
  hp: number;
  maxHp: number;
};

export function bossState(xp: number): BossState {
  const total = Math.max(0, Math.floor(xp));
  const defeated = Math.floor(total / BOSS_HP);
  return {
    defeated,
    name: BOSSES[defeated % BOSSES.length],
    hp: BOSS_HP - (total % BOSS_HP),
    maxHp: BOSS_HP,
  };
}

/** Names of bosses defeated by going from `xpBefore` to `xpAfter` XP. */
export function bossesDefeatedBetween(xpBefore: number, xpAfter: number): string[] {
  const from = bossState(xpBefore).defeated;
  const to = bossState(Math.max(xpBefore, xpAfter)).defeated;
  const names: string[] = [];
  for (let i = from; i < to; i++) names.push(BOSSES[i % BOSSES.length]);
  return names;
}
