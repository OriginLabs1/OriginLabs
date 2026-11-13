// Generate the OriginLabs icon set without any image dependency.
// A tiny supersampled rasteriser writes RGBA PNGs with zlib + CRC32.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const mobile = path.resolve(here, "..");
const outDir = path.resolve(mobile, "web/icons");
fs.mkdirSync(outDir, { recursive: true });

const BG = [7, 8, 10];
const ACID = [216, 255, 88];
const TEAL = [102, 227, 196];

function roundedRect(x, y, w, h, r) {
  const dx = Math.max(Math.abs(x - w / 2) - (w / 2 - r), 0);
  const dy = Math.max(Math.abs(y - h / 2) - (h / 2 - r), 0);
  return dx * dx + dy * dy <= r * r;
}

function inRing(x, y, cx, cy, radius, halfWidth) {
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy);
  if (Math.abs(d - radius) > halfWidth) return false;
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle < 0) angle += 360;
  // dasharray 630 / 212 on a 134 radius circle, rotated -38 degrees:
  // the visible arc runs from 322deg through 0 to 231deg; the gap is 231..322.
  const gapStart = 231.4;
  const gapEnd = 322;
  return !(angle > gapStart && angle < gapEnd);
}

function inCircle(x, y, cx, cy, r) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function render(size, maskable) {
  const scale = maskable ? 0.64 : 1;
  const cx = size / 2;
  const cy = size / 2;
  const art = (v) => v * (size / 512) * scale;
  const ss = 3;
  const out = Buffer.alloc(size * size * 4);
  const step = 1 / ss;
  const samples = ss * ss;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const px = x + (sx + 0.5) * step;
          const py = y + (sy + 0.5) * step;
          const inside = maskable
            ? true
            : roundedRect(px, py, size, size, (112 / 512) * size);
          if (!inside) continue;

          let color = BG;
          // Map into the 512 design space around the centre.
          const dx = (px - cx) / scale;
          const dy = (py - cy) / scale;
          const ux = 256 + dx;
          const uy = 256 + dy;
          if (inRing(ux, uy, 256, 256, 134 * (size / 512) / (size / 512), 13.5)) color = ACID;
          if (inCircle(ux, uy, 256, 256, 43)) color = ACID;
          if (inCircle(ux, uy, 382, 176, 25)) color = TEAL;
          r += color[0];
          g += color[1];
          b += color[2];
          a += 255;
        }
      }
      const total = maskable ? samples : samples;
      const idx = (y * size + x) * 4;
      out[idx] = Math.round(r / total);
      out[idx + 1] = Math.round(g / total);
      out[idx + 2] = Math.round(b / total);
      out[idx + 3] = Math.round(a / total);
    }
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const targets = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
  { file: "icon-1024.png", size: 1024, maskable: false },
];

for (const target of targets) {
  const bytes = png(target.size, render(target.size, target.maskable));
  fs.writeFileSync(path.join(outDir, target.file), bytes);
  console.log(`${target.file}: ${target.size}x${target.size}, ${bytes.length} bytes`);
}
