import { headers } from "next/headers";

/** Relative path of the QR join-link for a normalized squad code. */
export function joinInvitePath(code: string): string {
  return `/circle/join?code=${code}`;
}

/** Absolute origin from the request's headers (Vercel preview-deploy safe). */
export function requestOrigin(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/** Absolute join-invite URL for this request's host — the text the QR encodes. */
export async function joinInviteUrl(code: string): Promise<string> {
  return `${requestOrigin(await headers())}${joinInvitePath(code)}`;
}
