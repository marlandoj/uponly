// Generates the PWA icons in public/icons/ (dependency-free PNG encoder).
// Design: ChoreQuest mark — four rotated blocks (purple, cyan, orange, lime)
// on the dark tactical base. Run: node scripts/gen-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG = [11, 15, 12]; // #0b0f0c
const BLOCKS = [
  [139, 61, 255], // purple
  [34, 228, 255], // cyan
  [255, 122, 26], // orange
  [125, 255, 42], // lime
];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function icon(size, safeZone) {
  // Maskable icons keep the glyph inside the central 80% safe zone.
  const grid = size * (safeZone ? 0.42 : 0.52); // total 2x2 grid span
  const cx = size / 2, cy = size / 2;
  const block = grid / 2.25; // block size (gap = grid - 2*block)
  const rot = (-8 * Math.PI) / 180;

  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      // Un-rotate point around center to sample the axis-aligned grid.
      const px = x + 0.5 - cx, py = y + 0.5 - cy;
      const ux = px * Math.cos(-rot) - py * Math.sin(-rot);
      const uy = px * Math.sin(-rot) + py * Math.cos(-rot);
      let rgb = BG;
      if (Math.abs(ux) < grid / 2 && Math.abs(uy) < grid / 2) {
        const col = ux < 0 ? 0 : 1;
        const row = uy < 0 ? 0 : 1;
        const lx = Math.abs(ux) - (grid / 2 - block);
        const ly = Math.abs(uy) - (grid / 2 - block);
        if (lx >= 0 && lx < block && ly >= 0 && ly < block) {
          const c = BLOCKS[row * 2 + col];
          // Inset shading: darker toward bottom-right, like the CSS logo.
          const shade = 1 - 0.35 * ((lx / block + ly / block) / 2);
          rgb = c.map((v) => Math.round(v * shade));
        }
      }
      for (let i = 0; i < 3; i++) raw[o++] = rgb[i];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", icon(192, false));
writeFileSync("public/icons/icon-512.png", icon(512, false));
writeFileSync("public/icons/maskable-512.png", icon(512, true));
writeFileSync("public/icons/apple-touch-icon.png", icon(180, false));
console.log("wrote public/icons/*.png");
