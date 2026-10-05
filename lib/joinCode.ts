// Must match the alphabet in supabase/migrations/0001_init.sql (no 0/O/1/I/L).
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const JOIN_CODE_RE = /^[A-HJKMNP-Z2-9]{6}$/;

/** Uppercases and strips spaces/dashes; returns null if it can't be a valid code. */
export function normalizeJoinCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, "").toUpperCase();
  return JOIN_CODE_RE.test(code) ? code : null;
}
