// Types for scripts/pixel-sprite.mjs (tsconfig has allowJs: false).
export type Sprite = { palette: Record<string, string>; frames: [string[], string[]] };
export const PIXEL: number;
export const WIDTH: number;
export const HEIGHT: number;
export const SPRITES: Record<"plumber" | "runner" | "miner" | "marine" | "battlehero" | "elf" | "ghost" | "racer", Sprite>;
export const OUTPUT: string;
export function toBoxShadow(rows: string[], palette: Record<string, string>, px?: number): string;
export function buildCss(sprites?: Record<string, Sprite>, px?: number): string;
