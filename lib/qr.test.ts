import { describe, expect, it } from "vitest";
import { qrDataUrl } from "./qr";

const PREFIX = "data:image/svg+xml;charset=utf-8,";

describe("qrDataUrl", () => {
  it("returns an SVG data URL that decodes to a black-on-white SVG", async () => {
    const url = await qrDataUrl("https://example.com/circle/join?code=HK7M2Q");
    expect(url.startsWith(PREFIX)).toBe(true);
    const svg = decodeURIComponent(url.slice(PREFIX.length));
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("#000000"); // modules stay black for scannability
    expect(svg).toContain("#ffffff"); // background stays white
  });

  it("produces distinct codes for distinct texts", async () => {
    const a = await qrDataUrl("https://example.com/circle/join?code=HK7M2Q");
    const b = await qrDataUrl("https://example.com/circle/join?code=ZZ9X8Y");
    expect(a).not.toBe(b);
  });
});
