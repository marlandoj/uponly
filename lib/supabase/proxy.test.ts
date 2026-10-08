import { describe, expect, it, vi, beforeEach } from "vitest";

// --- Mocks ---------------------------------------------------------------

const { authMock, createServerClientMock } = vi.hoisted(() => {
  const authMock = {
    getUser: vi.fn(),
    signInAnonymously: vi.fn(),
  };
  const createServerClientMock = vi.fn(() => ({ auth: authMock }));
  return { authMock, createServerClientMock };
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("next/server", () => {
  class NextResponseMock {
    url: string | null = null;
    status = 200;
    cookies = { set: vi.fn() };
    static next() {
      return new NextResponseMock();
    }
    static redirect(url: string | URL) {
      const r = new NextResponseMock();
      r.url = String(url);
      r.status = 307;
      return r;
    }
  }
  return { NextResponse: NextResponseMock, NextRequest: class {} };
});

import { NextResponse } from "next/server";
import { updateSession } from "./proxy";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

function fakeRequest(pathname: string) {
  const nextUrl = new URL(`https://app.example${pathname}`);
  const req = {
    nextUrl: Object.assign(nextUrl, {
      clone() {
        const c = new URL(nextUrl.href) as URL & { clone(): URL };
        c.clone = () => new URL(c.href) as never;
        return c;
      },
    }),
    cookies: {
      getAll: () => [],
      set: vi.fn(),
    },
  };
  return req as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateSession guest access", () => {
  it("lets an existing session through without attempting anonymous sign-in", async () => {
    authMock.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const res = (await updateSession(fakeRequest("/"))) as InstanceType<typeof NextResponse>;
    expect(authMock.signInAnonymously).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.url).toBeNull();
  });

  it("signs in anonymously for a session-less visitor on a protected path", async () => {
    authMock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    authMock.signInAnonymously.mockResolvedValue({
      data: { user: { id: "guest-1" } },
      error: null,
    });
    const res = (await updateSession(fakeRequest("/quests"))) as InstanceType<typeof NextResponse>;
    expect(authMock.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200); // through, no redirect
    expect(res.url).toBeNull();
  });

  it("falls back to /login when anonymous sign-in fails", async () => {
    authMock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    authMock.signInAnonymously.mockResolvedValue({
      data: { user: null },
      error: { message: "Anonymous sign-ins are disabled" },
    });
    const res = (await updateSession(fakeRequest("/quests"))) as InstanceType<typeof NextResponse>;
    expect(res.status).toBe(307);
    expect(res.url).toContain("/login");
  });

  it("does not attempt anonymous sign-in on public paths", async () => {
    authMock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const login = (await updateSession(fakeRequest("/login"))) as InstanceType<typeof NextResponse>;
    expect(authMock.signInAnonymously).not.toHaveBeenCalled();
    expect(login.url).toBeNull();

    const callback = (await updateSession(fakeRequest("/auth/callback?code=x"))) as InstanceType<typeof NextResponse>;
    expect(authMock.signInAnonymously).not.toHaveBeenCalled();
    expect(callback.url).toBeNull();
  });
});
