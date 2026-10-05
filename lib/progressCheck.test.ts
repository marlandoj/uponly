import { describe, expect, it, vi } from "vitest";
import {
  CHECK_TIMEOUT_MS,
  DEFAULT_VISION_MODEL,
  PHOTO_ONLY,
  buildRequestBody,
  checkProgress,
  isPhotoOnlyPath,
  parseVerdict,
  raceSignal,
  visionConfigFromEnv,
} from "./progressCheck";

const input = {
  questTitle: "Dish Dragon",
  finishCondition: "Sink is empty",
  before: Uint8Array.of(0xff, 0xd8, 1),
  after: Uint8Array.of(0xff, 0xd8, 2),
};

const completion = (content: unknown, extra: Record<string, unknown> = {}) => ({
  choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content), ...extra } }],
});

const respond = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("visionConfigFromEnv", () => {
  it("reads the key from the environment and treats blank as absent", () => {
    expect(visionConfigFromEnv({ OPENAI_API_KEY: "sk-x" })).toEqual({
      apiKey: "sk-x",
      model: DEFAULT_VISION_MODEL,
    });
    expect(visionConfigFromEnv({ OPENAI_API_KEY: "  " }).apiKey).toBeUndefined();
    expect(visionConfigFromEnv({ OPENAI_VISION_MODEL: "m" }).model).toBe("m");
  });
});

describe("checkProgress", () => {
  it("degrades to photo-only without calling out when no API key is set", async () => {
    const f = vi.fn();
    const r = await checkProgress(input, { fetchImpl: f as unknown as typeof fetch });
    expect(r).toEqual({ verification: "photo-only", reason: PHOTO_ONLY.off });
    expect(f).not.toHaveBeenCalled();
  });

  it.each(["pass", "unclear", "fail"] as const)("returns the model's %s verdict", async (verdict) => {
    const f = respond(completion({ verdict, reason: "  The sink is clear.  " }));
    const r = await checkProgress(input, { apiKey: "sk-test", fetchImpl: f });
    expect(r).toEqual({ verification: verdict, reason: "The sink is clear." });
  });

  it("sends both photos, the condition and the key server-side", async () => {
    const f = respond(completion({ verdict: "pass", reason: "ok" }));
    await checkProgress(input, { apiKey: "sk-test", model: "vision-x", fetchImpl: f });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("vision-x");
    const parts = body.messages[1].content;
    expect(parts[0].text).toContain("Sink is empty");
    expect(parts.filter((p: { type: string }) => p.type === "image_url")).toHaveLength(2);
    expect(parts[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("degrades to photo-only on HTTP errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await checkProgress(input, { apiKey: "sk-test", fetchImpl: respond({}, 500) });
    expect(r).toEqual({ verification: "photo-only", reason: PHOTO_ONLY.unavailable });
    warn.mockRestore();
  });

  it("degrades to photo-only on network errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const r = await checkProgress(input, { apiKey: "sk-test", fetchImpl: f });
    expect(r.verification).toBe("photo-only");
    warn.mockRestore();
  });

  it("degrades to photo-only on refusals and malformed answers", async () => {
    for (const body of [
      completion("", { refusal: "I can't help with that" }),
      completion("not json"),
      completion({ verdict: "maybe", reason: "x" }),
      { choices: [] },
    ]) {
      const r = await checkProgress(input, { apiKey: "sk-test", fetchImpl: respond(body) });
      expect(r).toEqual({ verification: "photo-only", reason: PHOTO_ONLY.undecided });
    }
  });

  it("gives up at the deadline even if the API never answers", async () => {
    vi.useFakeTimers();
    try {
      const hang = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("timed out", "TimeoutError")), CHECK_TIMEOUT_MS);
      const pending = checkProgress(input, { apiKey: "sk-test", fetchImpl: hang, signal: controller.signal });
      await vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS);
      expect(await pending).toEqual({ verification: "photo-only", reason: PHOTO_ONLY.timeout });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("parseVerdict", () => {
  it("caps the reason length", () => {
    const v = parseVerdict(completion({ verdict: "pass", reason: "x".repeat(500) }));
    expect(v?.reason).toHaveLength(200);
  });
});

describe("buildRequestBody", () => {
  it("asks for a strict pass/unclear/fail schema", () => {
    const body = buildRequestBody(input, "m");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema.properties.verdict.enum).toEqual(["pass", "unclear", "fail"]);
  });
});

describe("isPhotoOnlyPath", () => {
  it("routes unclear and missing verdicts to the photo-only path", () => {
    expect(isPhotoOnlyPath("unclear")).toBe(true);
    expect(isPhotoOnlyPath("photo-only")).toBe(true);
    expect(isPhotoOnlyPath(null)).toBe(true);
    expect(isPhotoOnlyPath("pass")).toBe(false);
    expect(isPhotoOnlyPath("fail")).toBe(false);
  });
});

describe("raceSignal", () => {
  it("rejects immediately for an already-aborted signal", async () => {
    await expect(raceSignal(Promise.resolve(1), AbortSignal.abort("stop"))).rejects.toBe("stop");
  });
});
