// Draws the placeholder app icon (a white odometer gauge on orange) and writes PNGs to
// public/icons. Uses only Node built-ins. Run with: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const BG = [194, 65, 12];
const FG = [255, 255, 255];

const ICONS = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'apple-touch-icon.png', size: 180, scale: 1 },
  // Maskable icons get cropped to a circle, so keep the glyph inside the safe zone.
  { file: 'maskable-512.png', size: 512, scale: 0.78 },
];

// Is the point (x, y), in 0..1 icon space, inside the white glyph?
function inGlyph(x, y, scale) {
  const cx = 0.5;
  const cy = 0.54;
  const dx = (x - cx) / scale;
  const dy = (y - cy) / scale;
  const r = Math.hypot(dx, dy);

  // Gauge ring with a gap at the bottom (screen angles 45°..135°, y pointing down).
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const ring = r > 0.27 && r < 0.33 && !(angle > 45 && angle < 135);

  // Needle from the centre towards the upper right.
  const a = (-50 * Math.PI) / 180;
  const ex = Math.cos(a) * 0.22;
  const ey = Math.sin(a) * 0.22;
  const t = Math.max(0, Math.min(1, (dx * ex + dy * ey) / (ex * ex + ey * ey)));
  const needle = Math.hypot(dx - ex * t, dy - ey * t) < 0.028;

  const hub = r < 0.06;
  return ring || needle || hub;
}

function render(size, scale) {
  const px = Buffer.alloc(size * size * 4);
  const ss = 4; // 4x4 supersampling for smooth edges
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          if (inGlyph((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size, scale)) hits++;
        }
      }
      const c = hits / (ss * ss);
      const i = (y * size + x) * 4;
      for (let k = 0; k < 3; k++) px[i + k] = Math.round(BG[k] * (1 - c) + FG[k] * c);
      px[i + 3] = 255;
    }
  }
  return px;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const { file, size, scale } of ICONS) {
  writeFileSync(join(OUT, file), encodePng(size, render(size, scale)));
}
console.log(`Wrote ${ICONS.length} icons to public/icons`);
