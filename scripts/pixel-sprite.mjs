// Generates the Chore Crew pixel-art sprites (app/chore-crew.css) as CSS
// box-shadow art: one box-shadow entry per lit pixel on a 1×1 "pixel" element.
// Maps are string rows; each char is a palette key, "." is transparent.
// Every sprite faces right and carries its chore prop inside the map; frame A
// is mid-stride, frame B legs together. Run: node scripts/pixel-sprite.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Rendered size of one map pixel in CSS px (16×20 map → 48×60). */
export const PIXEL = 3;
export const WIDTH = 16;
export const HEIGHT = 20;

/** Upper body rows + two leg variants → the two walk frames. */
const frames = (upper, legsA, legsB) => [upper.concat(legsA), upper.concat(legsB)];

export const SPRITES = {
  // Plumber hero — red cap, blue overalls, pushing a mop
  plumber: {
    palette: {
      R: "#e8392b", r: "#a8231a", H: "#5a3418", S: "#f5b98a", K: "#1a1210",
      B: "#2f5fe0", b: "#1d3c9a", Y: "#ffd84d", W: "#f4f4f4", N: "#6b3a1a",
      T: "#c8955a", M: "#e6e6dc", m: "#a9ada2",
    },
    frames: frames(
      [
        "....RRRRR.......",
        "...RRRRRRRRR....",
        "...HHSSKS.......",
        "..HSHSSKSSS.....",
        "..HSSSSSSSSS....",
        "...HSSSSSSS.....",
        "....SSKKKS..T...",
        "...rRBRRBRr.T...",
        "..rRRBRRBRRWW...",
        "..RRBBBBBBRWW...",
        "..SSBYBBYBB..T..",
        "....BBBBBB...T..",
        "....bBBBBb...T..",
        "....BBBBBB...T..",
      ],
      [
        "...BBB..BBB...T.",
        "..BBB....BBB..T.",
        "..bB......Bb..T.",
        ".NNN.....NNN..T.",
        ".NNN.....NNNMMMM",
        "............MmMm",
      ],
      [
        "....BBBBBB....T.",
        "....BBB.BB....T.",
        "....bB..Bb....T.",
        "...NNN.NNN....T.",
        "...NNN.NNN..MMMM",
        "............mMmM",
      ],
    ),
  },
  // Speedy runner — blue tracksuit, headband, motion lines, feather duster
  runner: {
    palette: {
      K: "#20184a", W: "#f4f4f4", S: "#f0b080", E: "#101018", U: "#1e7bff",
      u: "#1450b8", L: "#22e4ff", D: "#8a5a2b", F: "#ff2fb3", f: "#ff9ad8",
      N: "#ff5d5d", n: "#f4f4f4",
    },
    frames: frames(
      [
        ".............FfF",
        "......KKKK...fFf",
        ".....KKKKKK..FfF",
        ".....WWWWWW...D.",
        ".....SSSESS..D..",
        ".....SSSSSS..D..",
        "......SSSS..SD..",
        "LLL..UUUUU.SS...",
        "....UUUWUUUS....",
        ".LL.UUUWUUU.....",
        "....SUUWUU......",
        "LLL..UUUUU......",
        ".....uuuuu......",
        ".LL..uuuuu......",
      ],
      [
        "....uuu..uu.....",
        "LL.uuu....uu....",
        "...uu......uu...",
        ".Luu........uu..",
        ".nNN........NNn.",
        "................",
      ],
      [
        ".....uuuuu......",
        "LL...uu.uu......",
        ".....uu.uu......",
        ".L...uu.uu......",
        "....nNN.NNn.....",
        "................",
      ],
    ),
  },
  // Blocky miner — square head, hard hat + lamp, earthy tones, sweeping with a broom
  miner: {
    palette: {
      A: "#e08a2a", V: "#fff3a0", H: "#4a2f1a", S: "#d9a066", s: "#b98048", E: "#24160c", P: "#7a4a2a",
      O: "#5e7d3a", o: "#46602a", b: "#5a4632", N: "#3a2a1c", T: "#a0703a",
      Y: "#e8c25a", y: "#b08a2a",
    },
    frames: frames(
      [
        "...AAAAAAAA.....",
        "..AAAAAAAVAA....",
        "...HSSSSSSH.....",
        "...SEESSEES.....",
        "...SSSSSSSS.....",
        "...SSSPPSSS..T..",
        "...sSSSSSSs..T..",
        "...OOOOOOOO..T..",
        ".SSOOOOOOOOSST..",
        ".SSOOOOOOOO..T..",
        ".SSoOOOOOOo..T..",
        ".SSOOOOOOOO..T..",
        "...bbbbbbbb..T..",
        "...bbbbbbbb..T..",
      ],
      [
        "...bbb..bbb..T..",
        "..bbb....bbb.T..",
        "..bbb....bbb.T..",
        ".NNN......NNYYY.",
        ".NNN......NYYYYY",
        "...........yYyYy",
      ],
      [
        "...bbbbbbbb..T..",
        "...bbb..bbb..T..",
        "...bbb..bbb..T..",
        "...NNN..NNN.YYY.",
        "...NNN..NNNYYYYY",
        "...........YyYyY",
      ],
    ),
  },
  // Space marine — green armor, cyan visor, spritzing a spray bottle
  marine: {
    palette: {
      G: "#4f9a3a", g: "#2f6a24", L: "#7dff2a", V: "#22e4ff", v: "#bdf6ff",
      D: "#1a2a18", W: "#f4f4f4", C: "#ff2fb3", c: "#ffd1ee", N: "#2a3328",
    },
    frames: frames(
      [
        ".....GGGGG......",
        "....GGGGGGG.....",
        "...GGGGGGGGG....",
        "...GGVVVVVVG....",
        "...GGVVVVVvG....",
        "...GGGGGGGGG....",
        "....gGGGGGg.....",
        "..LGGgggggGGL.WW",
        ".GGGGGGGGGGGGWW.",
        ".GG.GGLLGG.GGWc.",
        ".gg.GGGGGG..GCC.",
        ".DD.gGGGGg...CC.",
        "....DDDDDD...CC.",
        "....GGGGGG......",
      ],
      [
        "...GGG..GGG.....",
        "..GGG....GGG....",
        "..gG......Gg....",
        ".NNN......NNN...",
        ".NNN......NNN...",
        "................",
      ],
      [
        "....GGGGGG......",
        "....GGG.GG......",
        "....gG..Gg......",
        "...NNN.NNN......",
        "...NNN.NNN......",
        "................",
      ],
    ),
  },
};

/** Validates one map and returns its box-shadow value. */
export function toBoxShadow(rows, palette, px = PIXEL) {
  if (rows.length !== HEIGHT) throw new Error(`expected ${HEIGHT} rows, got ${rows.length}`);
  const shadows = [];
  rows.forEach((row, y) => {
    if (row.length !== WIDTH) throw new Error(`row ${y} is ${row.length} wide, expected ${WIDTH}: "${row}"`);
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      const color = palette[ch];
      if (!color) throw new Error(`row ${y} col ${x}: no palette color for "${ch}"`);
      // +1 offset: a box-shadow is never painted under its own 1px box.
      shadows.push(`${(x + 1) * px}px ${(y + 1) * px}px 0 0 ${color}`);
    });
  });
  return shadows.join(", ");
}

/** Full stylesheet: a base frame per sprite plus a 2-step walk-cycle keyframe. */
export function buildCss(sprites = SPRITES, px = PIXEL) {
  const out = [
    "/* GENERATED by scripts/pixel-sprite.mjs — do not edit by hand. */",
    `.cc-sprite { position: absolute; top: -${px}px; left: -${px}px; width: ${px}px; height: ${px}px; animation: var(--cc-step, 0.45s) steps(1, end) infinite; }`,
  ];
  for (const [name, { palette, frames: [a, b] }] of Object.entries(sprites)) {
    const shadowA = toBoxShadow(a, palette, px);
    const shadowB = toBoxShadow(b, palette, px);
    out.push(
      `.cc-sprite--${name} { box-shadow: ${shadowA}; animation-name: cc-frames-${name}; }`,
      `@keyframes cc-frames-${name} { 0% { box-shadow: ${shadowA}; } 50%, 100% { box-shadow: ${shadowB}; } }`,
    );
  }
  return out.join("\n") + "\n";
}

export const OUTPUT = fileURLToPath(new URL("../app/chore-crew.css", import.meta.url));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(OUTPUT, buildCss());
  console.log(`wrote ${OUTPUT}`);
}
