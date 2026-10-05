// Generates the PWA icons in public/icons/ (dependency-free PNG encoder).
// Design: white up-chevron on brand green. Run: node scripts/gen-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG = [22, 163, 74]; // #16a34a
const FG = [255, 255, 255];

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

// Distance from point to segment, for a thick anti-aliased chevron stroke.
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

function icon(size, safeZone) {
  // Maskable icons keep the glyph inside the central 80% safe zone.
  const s = size * (safeZone ? 0.55 : 0.7);
  const cx = size / 2, cy = size / 2;
  const apex = [cx, cy - s * 0.3];
  const left = [cx - s * 0.42, cy + s * 0.18];
  const right = [cx + s * 0.42, cy + s * 0.18];
  const half = s * 0.09;

  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.min(
        segDist(x + 0.5, y + 0.5, ...apex, ...left),
        segDist(x + 0.5, y + 0.5, ...apex, ...right),
      );
      const a = Math.max(0, Math.min(1, half - d + 0.5));
      for (let i = 0; i < 3; i++) raw[o++] = Math.round(BG[i] + (FG[i] - BG[i]) * a);
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
