import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ChoreCrew, { CREW, CrewWalker, SPAWN_MAX_MS, SPAWN_MIN_MS, nextDelay, pickWalk } from "./ChoreCrew";

const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe("ChoreCrew", () => {
  it("renders nothing on the server (motion preference unknown until mount)", () => {
    expect(renderToStaticMarkup(createElement(ChoreCrew))).toBe("");
  });

  it("spawns every 25–60s", () => {
    expect(nextDelay(() => 0)).toBe(SPAWN_MIN_MS);
    expect(nextDelay(() => 0.999999)).toBeLessThan(SPAWN_MAX_MS);
    expect(nextDelay(() => 0.999999)).toBeGreaterThan(SPAWN_MAX_MS - 1);
  });

  it("picks crew, lane, direction and pace within bounds", () => {
    expect(pickWalk(1, () => 0)).toEqual({ id: 1, who: CREW[0], lane: 1, dir: "ltr", duration: 14 });
    const hi = pickWalk(2, () => 0.999999);
    expect(hi.who).toBe(CREW[CREW.length - 1]);
    expect(hi.dir).toBe("rtl");
    expect(hi.lane).toBeLessThanOrEqual(22);
    expect(hi.duration).toBeLessThanOrEqual(24);
    expect(pickWalk(3, seq(0.5, 0.5, 0.2, 0.5)).who).toBe("miner");
  });

  it("renders a walker with its sprite, direction and timing vars", () => {
    const html = renderToStaticMarkup(
      createElement(CrewWalker, { walk: { id: 0, who: "marine", lane: 7.5, dir: "rtl", duration: 18 }, onDone: () => {} }),
    );
    expect(html).toContain("cc-walker cc-walker--rtl");
    expect(html).toContain("cc-sprite cc-sprite--marine");
    expect(html).toContain("--cc-lane:7.5vh");
    expect(html).toContain("--cc-duration:18s");
  });
});
