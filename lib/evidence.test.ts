import { describe, expect, it } from "vitest";
import {
  EVIDENCE_ACCEPT,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  checkEvidence,
  evidenceExt,
  evidencePath,
  isVideoPath,
  looksLikeVideo,
} from "./evidence";
import { photoPath } from "./quests";

const MB = 1024 * 1024;

describe("checkEvidence", () => {
  it("allowlists JPEG, MP4 and WebM only", () => {
    expect(checkEvidence("image/jpeg", 1)).toMatchObject({ ok: true, ext: "jpg", video: false });
    expect(checkEvidence("video/mp4", 1)).toMatchObject({ ok: true, ext: "mp4", video: true });
    expect(checkEvidence("video/webm", 1)).toMatchObject({ ok: true, ext: "webm", video: true });
    for (const t of ["image/png", "image/webp", "image/heic", "video/quicktime", "application/pdf", ""]) {
      expect(checkEvidence(t, 1)).toMatchObject({ ok: false, status: 415 });
    }
  });

  it("ignores codec parameters and case", () => {
    expect(checkEvidence("video/webm;codecs=vp8,opus", 1)).toMatchObject({ ok: true, mime: "video/webm" });
    expect(checkEvidence("Video/MP4", 1)).toMatchObject({ ok: true, mime: "video/mp4" });
  });

  it("caps JPEGs at 10 MB and clips at 50 MB", () => {
    expect(MAX_PHOTO_BYTES).toBe(10 * MB);
    expect(MAX_VIDEO_BYTES).toBe(50 * MB);
    expect(checkEvidence("image/jpeg", 10 * MB)).toMatchObject({ ok: true });
    expect(checkEvidence("image/jpeg", 10 * MB + 1)).toMatchObject({ ok: false, status: 413 });
    expect(checkEvidence("image/jpeg", 20 * MB)).toMatchObject({ ok: false, status: 413 });
    expect(checkEvidence("video/mp4", 20 * MB)).toMatchObject({ ok: true });
    expect(checkEvidence("video/mp4", 50 * MB)).toMatchObject({ ok: true });
    expect(checkEvidence("video/webm", 50 * MB + 1)).toMatchObject({ ok: false, status: 413 });
  });

  it("accept string lists exactly the allowlist", () => {
    expect(EVIDENCE_ACCEPT).toBe("image/jpeg,video/mp4,video/webm");
  });
});

describe("looksLikeVideo", () => {
  const mp4 = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypmp42")]);
  const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);

  it("matches the container magic bytes", () => {
    expect(looksLikeVideo(mp4, "video/mp4")).toBe(true);
    expect(looksLikeVideo(webm, "video/webm")).toBe(true);
  });

  it("rejects mislabeled or truncated uploads", () => {
    expect(looksLikeVideo(jpeg, "video/mp4")).toBe(false);
    expect(looksLikeVideo(jpeg, "video/webm")).toBe(false);
    expect(looksLikeVideo(webm, "video/mp4")).toBe(false);
    expect(looksLikeVideo(mp4, "video/webm")).toBe(false);
    expect(looksLikeVideo(new Uint8Array([0x1a, 0x45]), "video/webm")).toBe(false);
  });
});

describe("evidence paths", () => {
  it("builds <uid>/<run>/<kind>.<ext>; photoPath still defaults to .jpg", () => {
    expect(evidencePath("u", "r", "after", "mp4")).toBe("u/r/after.mp4");
    expect(photoPath("u", "r", "before")).toBe("u/r/before.jpg");
    expect(photoPath("u", "r", "after", "webm")).toBe("u/r/after.webm");
  });

  it("tells clips from photos", () => {
    expect(evidenceExt("u/r/after.webm")).toBe("webm");
    expect(evidenceExt("u/r/after.png")).toBeNull();
    expect(evidenceExt(null)).toBeNull();
    expect(isVideoPath("u/r/after.mp4")).toBe(true);
    expect(isVideoPath("u/r/after.jpg")).toBe(false);
    expect(isVideoPath(null)).toBe(false);
  });
});
