// Evidence uploads: JPEG photos or short MP4/WebM clips in the private
// `evidence` bucket. Must match the bucket limits in 0009_visual_verification.sql
// and the extension search in public.evidence_object_path().

export type EvidenceKind = "before" | "after";
export type EvidenceExt = "jpg" | "mp4" | "webm";
export type EvidenceMime = "image/jpeg" | "video/mp4" | "video/webm";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export const EVIDENCE_TYPES: Record<EvidenceMime, { ext: EvidenceExt; maxBytes: number; video: boolean }> = {
  "image/jpeg": { ext: "jpg", maxBytes: MAX_PHOTO_BYTES, video: false },
  "video/mp4": { ext: "mp4", maxBytes: MAX_VIDEO_BYTES, video: true },
  "video/webm": { ext: "webm", maxBytes: MAX_VIDEO_BYTES, video: true },
};

export const EVIDENCE_EXTS: EvidenceExt[] = ["jpg", "mp4", "webm"];

/** For file inputs / recorders: every type the upload route accepts. */
export const EVIDENCE_ACCEPT = Object.keys(EVIDENCE_TYPES).join(",");

export type EvidenceCheck =
  | { ok: true; mime: EvidenceMime; ext: EvidenceExt; video: boolean }
  | { ok: false; status: 413 | 415; error: string };

/**
 * Allowlist + per-type size cap for an upload. `type` is the browser-reported
 * MIME type; codec parameters ("video/webm;codecs=vp8") are ignored.
 */
export function checkEvidence(type: string, size: number): EvidenceCheck {
  const mime = type.split(";")[0].trim().toLowerCase();
  if (!(mime in EVIDENCE_TYPES)) {
    return { ok: false, status: 415, error: "Evidence must be a JPEG photo or an MP4/WebM clip from the in-app camera" };
  }
  const t = EVIDENCE_TYPES[mime as EvidenceMime];
  if (size > t.maxBytes) {
    return { ok: false, status: 413, error: t.video ? "Clip is too large (50 MB max)" : "Photo is too large (10 MB max)" };
  }
  return { ok: true, mime: mime as EvidenceMime, ext: t.ext, video: t.video };
}

/** Magic-byte check so a mislabeled upload can't claim to be a clip. */
export function looksLikeVideo(bytes: Uint8Array, mime: "video/mp4" | "video/webm"): boolean {
  if (mime === "video/webm") {
    // EBML header
    return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  }
  // ISO BMFF: first box is "ftyp" at offset 4
  return bytes.length >= 8 && String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === "ftyp";
}

export const evidencePath = (userId: string, runId: string, kind: EvidenceKind, ext: EvidenceExt) =>
  `${userId}/${runId}/${kind}.${ext}`;

/** The extension of a stored evidence path, or null if it isn't one we write. */
export function evidenceExt(path: string | null): EvidenceExt | null {
  const m = path?.match(/\.(jpg|mp4|webm)$/);
  return m ? (m[1] as EvidenceExt) : null;
}

export const isVideoPath = (path: string | null) => {
  const ext = evidenceExt(path);
  return ext === "mp4" || ext === "webm";
};
