import { describe, expect, it } from "vitest";
import { isJpeg, stripJpegMetadata } from "./jpeg";

const seg = (marker: number, payload: number[]) => {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 0xff, ...payload];
};

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

const APP0 = seg(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const EXIF = seg(0xe1, [...ascii("Exif"), 0, 0, ...ascii("GPS-SECRET")]);
const XMP = seg(0xe1, ascii("http://ns.adobe.com/xap/1.0/ secret"));
const COMMENT = seg(0xfe, ascii("shot on my phone"));
const DQT = seg(0xdb, [0, ...Array(64).fill(1)]);
const SOF = seg(0xc0, [8, 0, 1, 0, 1, 1, 1, 0x11, 0]);
const SOS = [...seg(0xda, [1, 1, 0, 0, 0x3f, 0]), 0x12, 0xff, 0x00, 0x34];
const EOI = [0xff, 0xd9];

const jpeg = (...parts: number[][]) => Uint8Array.from([0xff, 0xd8, ...parts.flat()]);

describe("stripJpegMetadata", () => {
  it("removes EXIF, XMP and comments but keeps decode-critical segments", () => {
    const input = jpeg(APP0, EXIF, XMP, COMMENT, DQT, SOF, SOS, EOI);
    const out = stripJpegMetadata(input)!;
    expect(out).toEqual(jpeg(APP0, DQT, SOF, SOS, EOI));
    expect(Buffer.from(out).includes("GPS-SECRET")).toBe(false);
    expect(Buffer.from(out).includes("secret")).toBe(false);
  });

  it("is a no-op on an already clean file", () => {
    const clean = jpeg(APP0, DQT, SOF, SOS, EOI);
    expect(stripJpegMetadata(clean)).toEqual(clean);
  });

  it("copies scan data verbatim, including stuffed and marker-like bytes", () => {
    const scan = [...seg(0xda, [1, 1, 0, 0, 0x3f, 0]), 0xff, 0x00, 0xff, 0xd0, 0x01, 0xff, 0xe1];
    const input = jpeg(DQT, SOF, scan, EOI);
    expect(stripJpegMetadata(input)).toEqual(input);
  });

  it("rejects non-JPEG and truncated input", () => {
    expect(stripJpegMetadata(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0]))).toBeNull();
    expect(stripJpegMetadata(jpeg(APP0, [0xff, 0xe1, 0x40, 0x00, 1, 2]))).toBeNull();
    expect(stripJpegMetadata(jpeg(APP0))).toBeNull();
  });

  it("isJpeg checks the SOI magic", () => {
    expect(isJpeg(jpeg(APP0))).toBe(true);
    expect(isJpeg(Uint8Array.from([0xff, 0xd8]))).toBe(false);
  });
});
