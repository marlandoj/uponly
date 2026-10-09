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
  // Battle-royale hero — purple hoodie, yellow backpack, a garbage bag in each
  // hand; the bags swap heights between frames for a heavy-laden waddle
  battlehero: {
    palette: {
      P: "#8b3dff", p: "#5b1fc4", T: "#22e4ff", O: "#ff7a1a", S: "#f0b080", E: "#101018",
      K: "#ffd84d", k: "#b08a2a", G: "#1a1a1e", g: "#3c3c48", Y: "#ffd84d",
      J: "#2f5fe0", j: "#1d3c9a", N: "#f4f4f4", n: "#ff2fb3",
    },
    frames: [
      [
        ".....PPPPP......",
        "....PPPPPPPP....",
        "....PPPSSESS....",
        "....PPPSSSSS....",
        ".....PPSSSS.....",
        "...KKPPPPPPP....",
        "..KKKPTTPPPPP...",
        "..KkKPPOOPPPPS..",
        ".SKKKPPPPPPP.S..",
        ".SKkKPPPPPPP.Y..",
        ".YKKKpppppp.GGG.",
        "GGG..JJJJJJGGGGG",
        "GGGG.JJJJJJGgGGG",
        "GgGG.JJJJJJGGGGG",
        "GGGGJJJ..JJJGGG.",
        ".GGJJJ....JJJ...",
        "...jJ......Jj...",
        "..NNN......NNN..",
        "..nnN......nnN..",
        "................",
      ],
      [
        ".....PPPPP......",
        "....PPPPPPPP....",
        "....PPPSSESS....",
        "....PPPSSSSS....",
        ".....PPSSSS.....",
        "...KKPPPPPPP....",
        "..KKKPTTPPPPP...",
        ".SKkKPPOOPPPPS..",
        ".SKKKPPPPPPP.S..",
        ".YKkKPPPPPPP.S..",
        "GGGGKpppppp..Y..",
        "GGGG.JJJJJJ.GGG.",
        "GgGG.JJJJJJGGGGG",
        "GGGG.JJJJJJGgGGG",
        ".GG..JJJJJJGGGGG",
        ".....JJJ.JJ.GGG.",
        ".....jJ..Jj.....",
        "....NNN.NNN.....",
        "....nnN.nnN.....",
        "................",
      ],
    ],
  },
  // Woodland hero — green tunic and pointed cap, carrying a comically tall
  // stack of dishes that sways side to side every step
  elf: {
    palette: {
      C: "#3fae3a", c: "#1f6a24", H: "#ffd84d", S: "#f5c79a", E: "#101018",
      T: "#3fae3a", t: "#1f6a24", B: "#6b3a1a", b: "#ffd84d", L: "#f4f0dc",
      N: "#6b3a1a", W: "#f4f4f4", w: "#8fd0ff", M: "#ff5d5d",
    },
    frames: [
      [
        "............MM..",
        "............WWWW",
        "...........wwww.",
        "...........WWWW.",
        "..........wwww..",
        ".....CCC..WWWW..",
        "....CCCCC.wwww..",
        "..ccCCCCCCWWWW..",
        "...HHSSES.wwww..",
        ".SSHSSSSS.WWWW..",
        "...HSSSSS.wwww..",
        "....TTTTSSSSSS..",
        "...TTTTTTTS.....",
        "...TBBbBBT......",
        "...TTTTTTT......",
        "...tTTTTTt......",
        "...LLL..LLL.....",
        "..LLL....LLL....",
        ".NNN......NNN...",
        ".NNN......NNNN..",
      ],
      [
        "........MM......",
        "........WWWW....",
        ".........wwww...",
        ".........WWWW...",
        "..........wwww..",
        ".....CCC..WWWW..",
        "....CCCCC.wwww..",
        "..ccCCCCCCWWWW..",
        "...HHSSES.wwww..",
        ".SSHSSSSS.WWWW..",
        "...HSSSSS.wwww..",
        "....TTTTSSSSSS..",
        "...TTTTTTTS.....",
        "...TBBbBBT......",
        "...TTTTTTT......",
        "...tTTTTTt......",
        "....LLLLLL......",
        "....LLL.LL......",
        "...NNN.NNN......",
        "...NNN.NNNN.....",
      ],
    ],
  },
  // Arcade ghost — round, rosy-cheeked, trailing a feather duster; bobs up a
  // pixel and ripples its skirt for a happy wobble
  ghost: {
    palette: {
      W: "#f4f4f4", w: "#c8d0e0", E: "#20184a", P: "#ff9ad8",
      D: "#8a5a2b", F: "#ff2fb3", f: "#ffd84d",
    },
    frames: [
      [
        "................",
        "................",
        "........WWWW....",
        "......WWWWWWWW..",
        ".....WWWWWWWWWW.",
        ".....WWWWWEWWEW.",
        "....WWWWWWEWWEW.",
        "....WWWWWPWWWWP.",
        "....WWWWWWWEEWW.",
        "....WWWWWWWWWWW.",
        "FfF.wWWWWWWWWWW.",
        "fFfDDWWWWWWWWWW.",
        "FfF.wWWWWWWWWWW.",
        "....wWWWWWWWWWW.",
        "....wwWWWWWWWWW.",
        "....wWWwWWWwWWW.",
        "....WW.WWW.WWW..",
        ".....W..W...W...",
        "................",
        "................",
      ],
      [
        "................",
        "........WWWW....",
        "......WWWWWWWW..",
        ".....WWWWWWWWWW.",
        ".....WWWWWEWWEW.",
        "....WWWWWWEWWEW.",
        "....WWWWWPWWWWP.",
        "....WWWWWWWEEWW.",
        "....WWWWWWWWWWW.",
        ".fF.wWWWWWWWWWW.",
        "FfFDDWWWWWWWWWW.",
        "fFf.wWWWWWWWWWW.",
        "....wWWWWWWWWWW.",
        "....wwWWWWWWWWW.",
        "....wWWWwWWWwWW.",
        "....W.WWW.WWW.W.",
        "......W...W...W.",
        "................",
        "................",
        "................",
      ],
    ],
  },
  // Kart racer — red helmet, white racing suit, speed lines, vacuum hose
  racer: {
    palette: {
      H: "#e8392b", h: "#a8231a", V: "#22e4ff", v: "#bdf6ff", U: "#f4f4f4",
      R: "#e8392b", K: "#1a1a1e", L: "#ffd84d", G: "#6a7480", N: "#2a3328",
    },
    frames: frames(
      [
        "................",
        ".....HHHHH......",
        "....HHHHHHH.....",
        "....HHHVVVVH....",
        "L...HHHVvVVH....",
        "....hHHHHHHH....",
        "LL...hhhhhh.....",
        "....UUURUUUU....",
        "LL..UUURUUUUK...",
        "....UUURUUU.G...",
        "LLL.UUURUUU.G...",
        "....KKKKKKK..G..",
        ".L..UUURUUU..G..",
        "....UUURUUU...G.",
      ],
      [
        "...UUU..UUU...G.",
        "L.UUU....UUU..G.",
        "..UR......RU..G.",
        ".KKK......KKK.G.",
        ".KKK......KKKNNN",
        "............NNNN",
      ],
      [
        "....UUUUUU....G.",
        "L...UUU.UU....G.",
        "....UR..RU....G.",
        "...KKK.KKK....G.",
        "...KKK.KKK...NNN",
        "............NNNN",
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
