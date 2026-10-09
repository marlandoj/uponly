import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CREW } from "@/app/ChoreCrew";
import { HEIGHT, OUTPUT, PIXEL, SPRITES, WIDTH, buildCss, toBoxShadow } from "./pixel-sprite.mjs";

const SHADOW = /^(\d+)px (\d+)px 0 0 (#[0-9a-f]{6}(?:[0-9a-f]{2})?)$/;
const css = readFileSync(OUTPUT, "utf8");
const lit = (rows: string[]) => rows.join("").replace(/\./g, "").length;

describe("pixel-sprite", () => {
  it("committed app/chore-crew.css is up to date with the maps", () => {
    expect(css).toBe(buildCss());
  });

  it("defines exactly the crew the component spawns", () => {
    expect(Object.keys(SPRITES).sort()).toEqual([...CREW].sort());
  });

  it("emits one well-formed box-shadow entry per lit pixel, inside the sprite box", () => {
    for (const { palette, frames } of Object.values(SPRITES)) {
      for (const rows of frames) {
        const entries = toBoxShadow(rows, palette).split(", ");
        expect(entries).toHaveLength(lit(rows));
        for (const e of entries) {
          const m = SHADOW.exec(e);
          expect(m, e).not.toBeNull();
          const [x, y] = [Number(m![1]), Number(m![2])];
          expect(x % PIXEL).toBe(0);
          expect(y % PIXEL).toBe(0);
          expect(x).toBeGreaterThanOrEqual(PIXEL);
          expect(x).toBeLessThanOrEqual(WIDTH * PIXEL);
          expect(y).toBeLessThanOrEqual(HEIGHT * PIXEL);
        }
      }
    }
  });

  it("maps pixel (x, y) to offset ((x+1)·px, (y+1)·px)", () => {
    const rows = Array.from({ length: HEIGHT }, (_, y) => (y === 2 ? "...A" : ".").padEnd(WIDTH, "."));
    expect(toBoxShadow(rows, { A: "#ff0000" }, 4)).toBe("16px 12px 0 0 #ff0000");
  });

  it("walk frames differ (legs alternate)", () => {
    for (const [name, { frames }] of Object.entries(SPRITES)) {
      expect(frames[0].join(""), name).not.toBe(frames[1].join(""));
    }
  });

  it("writes a base rule and a two-step keyframe per sprite with balanced braces", () => {
    for (const name of Object.keys(SPRITES)) {
      expect(css).toContain(`.cc-sprite--${name} { box-shadow: `);
      expect(css).toMatch(new RegExp(`@keyframes cc-frames-${name} \\{ 0% \\{ box-shadow: [^}]+; \\} 50%, 100% \\{ box-shadow: [^}]+; \\} \\}`));
    }
    expect(css.split("{").length).toBe(css.split("}").length);
  });

  it("rejects ragged rows and unknown palette keys", () => {
    const blank = Array.from({ length: HEIGHT }, () => ".".repeat(WIDTH));
    expect(() => toBoxShadow([...blank.slice(1), "..."], {})).toThrow(/wide/);
    expect(() => toBoxShadow([...blank.slice(1), "Z".padEnd(WIDTH, ".")], {})).toThrow(/palette/);
  });
});
