/** Cookie that carries the post-sign-in destination through the magic-link round trip. */
export const NEXT_COOKIE = "uponly_next";

/** Same-origin relative path or null (blocks "//evil.com", "/\\evil.com", absolute URLs). */
export function safeNext(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 200) return null;
  if (!input.startsWith("/") || input.startsWith("//") || input.startsWith("/\\")) return null;
  if (/[\u0000-\u001f]/.test(input)) return null;
  return input;
}
