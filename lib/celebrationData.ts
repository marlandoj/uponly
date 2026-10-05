import QRCode from "qrcode";
import { headers } from "next/headers";
import {
  PHOTO_URL_TTL_SECONDS,
  isEvidencePathFor,
  normalizeRatingCode,
  ratingPath,
  type Celebration,
} from "@/lib/celebration";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * The celebration behind a share code, or null. The RPC returns a row only if
 * the caller is in the quest's circle — that's the membership check that
 * gates photo signing below.
 */
export async function getCelebration(rawCode: string): Promise<Celebration | null> {
  const code = normalizeRatingCode(rawCode);
  if (!code) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_celebration", { p_code: code })
    .maybeSingle<Celebration>();
  if (error) throw error;
  return data;
}

export type CelebrationPhotos = { before: string | null; after: string | null };

/**
 * 5-minute signed URLs for a celebration's photos. Storage is owner-only, so
 * this signs with the service-role client — call it only with a row returned
 * by getCelebration (i.e. after the membership check). Without the service
 * key, photos are simply unavailable.
 */
export async function signCelebrationPhotos(c: Celebration): Promise<CelebrationPhotos> {
  const admin = createAdminClient();
  const paths = [c.before_path, c.after_path].filter((p) => isEvidencePathFor(p, c.player_id, c.run_id));
  if (!admin || paths.length === 0) return { before: null, after: null };

  const { data, error } = await admin.storage.from("evidence").createSignedUrls(paths, PHOTO_URL_TTL_SECONDS);
  if (error) {
    console.warn("celebration: couldn't sign photo URLs:", error.message);
    return { before: null, after: null };
  }
  const url = (p: string | null) => data.find((d) => d.path === p && !d.error)?.signedUrl ?? null;
  return { before: url(c.before_path), after: url(c.after_path) };
}

/** Absolute URL of the rating page for a code, from the request's host. */
export async function ratingUrl(code: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}${ratingPath(code)}`;
}

/** QR code for a URL as an SVG data URL (rendered server-side, no client JS). */
export async function qrDataUrl(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
