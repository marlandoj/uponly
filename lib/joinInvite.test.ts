import { describe, expect, it } from "vitest";
import { joinInvitePath, requestOrigin } from "./joinInvite";

describe("joinInvitePath", () => {
  it("builds the relative join-link path for a code", () => {
    expect(joinInvitePath("HK7M2Q")).toBe("/circle/join?code=HK7M2Q");
  });
});

describe("requestOrigin", () => {
  it("prefers forwarded host and proto (Vercel preview deployments)", () => {
    const h = new Headers({
      "x-forwarded-host": "uponly-git-feat-qr-marlandoj.vercel.app",
      "x-forwarded-proto": "https",
      host: "internal-host",
    });
    expect(requestOrigin(h)).toBe("https://uponly-git-feat-qr-marlandoj.vercel.app");
  });

  it("falls back to the direct host with https", () => {
    expect(requestOrigin(new Headers({ host: "uponly.example.com" }))).toBe(
      "https://uponly.example.com",
    );
  });

  it("uses http for localhost and loopback", () => {
    expect(requestOrigin(new Headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(requestOrigin(new Headers({ host: "127.0.0.1:3000" }))).toBe("http://127.0.0.1:3000");
  });

  it("defaults to http://localhost:3000 with no headers", () => {
    expect(requestOrigin(new Headers())).toBe("http://localhost:3000");
  });
});
