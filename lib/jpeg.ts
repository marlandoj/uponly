// Server-side JPEG metadata stripping, no dependencies. The camera capture
// already re-encodes through a canvas (which drops EXIF), but the route handler
// can't trust the client, so every upload is re-scanned here.
//
// Drops APP1–APP15 (EXIF/XMP/ICC/maker notes, incl. GPS) and COM segments;
// keeps APP0 (JFIF) and everything needed to decode. Scan data after SOS is
// copied verbatim.

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const COM = 0xfe;

export function isJpeg(buf: Uint8Array): boolean {
  return buf.length > 4 && buf[0] === 0xff && buf[1] === SOI && buf[2] === 0xff;
}

/** Returns a metadata-free copy, or null if the bytes aren't a well-formed JPEG. */
export function stripJpegMetadata(buf: Uint8Array): Uint8Array | null {
  if (!isJpeg(buf)) return null;

  const out: Uint8Array[] = [buf.subarray(0, 2)];
  let i = 2;

  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    // Markers may be preceded by any number of 0xFF fill bytes.
    while (i < buf.length && buf[i] === 0xff) i++;
    if (i >= buf.length) return null;
    const marker = buf[i];
    i++;

    // Standalone markers (no length field).
    if (marker === EOI) {
      out.push(Uint8Array.of(0xff, EOI));
      return concat(out);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(Uint8Array.of(0xff, marker));
      continue;
    }

    if (i + 2 > buf.length) return null;
    const len = (buf[i] << 8) | buf[i + 1];
    if (len < 2 || i + len > buf.length) return null;
    const segEnd = i + len;

    if (marker === SOS) {
      // Header + entropy-coded data through EOI: copy as-is.
      out.push(Uint8Array.of(0xff, SOS), buf.subarray(i));
      return concat(out);
    }

    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === COM;
    if (!isMetadata) out.push(Uint8Array.of(0xff, marker), buf.subarray(i, segEnd));
    i = segEnd;
  }
  return null;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
