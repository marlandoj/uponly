import { afterEach, describe, expect, it, vi } from "vitest";
import * as sfx from "./sfx";

afterEach(() => {
  sfx._reset();
  vi.unstubAllGlobals();
});

const calls = () => [sfx.click, sfx.questStart, sfx.questComplete, sfx.startMusic, sfx.stopMusic];

describe("sfx", () => {
  it("never throws without a window (SSR)", () => {
    for (const fn of calls()) expect(() => fn()).not.toThrow();
    expect(sfx.isMuted()).toBe(false);
    expect(sfx.toggleMute()).toBe(true);
    expect(sfx.isMuted()).toBe(true);
  });

  it("never throws when the browser has no AudioContext", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => null, setItem: () => {} } });
    for (const fn of calls()) expect(() => fn()).not.toThrow();
    expect(sfx.isMusicPlaying()).toBe(false);
  });

  it("never throws when AudioContext or storage blow up", () => {
    vi.stubGlobal("window", {
      AudioContext: class {
        constructor() {
          throw new Error("blocked");
        }
      },
      get localStorage(): Storage {
        throw new Error("denied");
      },
    });
    for (const fn of calls()) expect(() => fn()).not.toThrow();
    expect(() => sfx.toggleMute()).not.toThrow();
  });

  it("persists mute under cq-muted and notifies subscribers", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) } });
    const seen: boolean[] = [];
    sfx.subscribe(() => seen.push(sfx.isMuted()));
    expect(sfx.toggleMute()).toBe(true);
    expect(store.get("cq-muted")).toBe("1");
    expect(sfx.toggleMute()).toBe(false);
    expect(store.get("cq-muted")).toBe("0");
    expect(seen).toEqual([true, false]);
  });

  it("reads a saved mute and stays silent", () => {
    const ctor = vi.fn();
    vi.stubGlobal("window", { AudioContext: ctor, localStorage: { getItem: () => "1", setItem: () => {} } });
    sfx.click();
    sfx.startMusic();
    expect(sfx.isMuted()).toBe(true);
    expect(ctor).not.toHaveBeenCalled();
    expect(sfx.isMusicPlaying()).toBe(false);
  });

  it("synthesizes on demand with a working AudioContext, and mute stops the loop", () => {
    vi.useFakeTimers();
    let oscillators = 0;
    const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
    const node = () => ({ gain: param(), connect: (n: unknown) => n });
    class FakeCtx {
      static made = 0;
      currentTime = 0;
      state = "running";
      destination = {};
      constructor() {
        FakeCtx.made++;
      }
      createGain = node;
      createOscillator = () => {
        oscillators++;
        return { type: "", frequency: param(), connect: (n: unknown) => n, start() {}, stop() {} };
      };
      close = async () => {};
    }
    vi.stubGlobal("window", { AudioContext: FakeCtx, localStorage: { getItem: () => null, setItem: () => {} } });
    expect(FakeCtx.made).toBe(0); // lazy
    sfx.click();
    expect(FakeCtx.made).toBe(1);
    expect(oscillators).toBe(1);
    sfx.questStart();
    expect(oscillators).toBe(1 + sfx.QUEST_START.length);
    sfx.questComplete();
    expect(sfx.QUEST_COMPLETE.filter((n) => n.wave === "square").length).toBeGreaterThanOrEqual(8);
    sfx.startMusic();
    expect(sfx.isMusicPlaying()).toBe(true);
    sfx.toggleMute();
    expect(sfx.isMusicPlaying()).toBe(false);
    sfx.toggleMute();
    expect(sfx.isMusicPlaying()).toBe(true); // resumes: the gesture already happened
    expect(FakeCtx.made).toBe(1);
    vi.useRealTimers();
  });

  it("power-up is C5 E5 G5 C6 and the loop is in A minor", () => {
    const lead = sfx.QUEST_START.filter((n) => n.wave === "square").map((n) => Math.round(n.hz));
    expect(lead).toEqual([523, 659, 784, 1047]);
    const aMinor = new Set([9, 11, 0, 2, 4, 5, 7]);
    for (let s = 0; s < sfx.MUSIC_STEPS; s++) for (const m of sfx.musicStep(s)) expect(aMinor.has(m % 12)).toBe(true);
    expect(sfx.MUSIC_GAIN).toBeLessThanOrEqual(0.05);
    expect(sfx.MASTER_GAIN).toBeLessThanOrEqual(0.2);
  });
});
