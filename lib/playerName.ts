// How a squadmate is named in lists: their gamer tag when they've set one,
// else the display name (which defaults to "Player" at sign-up).

export type NamedProfile = { display_name: string; gamer_tag?: string | null };

export function playerName(p: NamedProfile): string {
  return p.gamer_tag?.trim() || p.display_name;
}

/** A chore level as shown in rosters, e.g. "Lv 3.50". */
export function levelLabel(level: number | string | null | undefined): string {
  return `Lv ${Number(level ?? 3.5).toFixed(2)}`;
}
