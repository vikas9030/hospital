// Generates PWA icons: teal gradient rounded square + white medical cross.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });

function svg(size, { pad = 0, radius = 0.24 } = {}) {
  const inner = size - pad * 2;
  const r = Math.round(size * radius);
  const cx = size / 2;
  // cross arms
  const t = Math.round(inner * 0.30); // arm thickness
  const L = Math.round(inner * 0.72); // arm length
  const x0 = Math.round(cx - L / 2);
  const y0 = Math.round(cx - t / 2);
  // pulse line across the cross
  const pulse = `M ${x0 - inner * 0.06} ${cx} L ${cx - t} ${cx} L ${cx - t * 0.45} ${cx - t * 0.55} L ${cx + t * 0.15} ${cx + t * 0.55} L ${cx + t * 0.45} ${cx} L ${x0 + L + inner * 0.06} ${cx}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0d9488"/><stop offset="1" stop-color="#047857"/>
  </linearGradient></defs>
  <rect width="${size}" height="${size}" rx="${pad > 0 ? 0 : r}" fill="url(#g)"/>
  <rect x="${x0}" y="${y0}" width="${L}" height="${t}" rx="${Math.round(t / 3)}" fill="#ffffff"/>
  <rect x="${y0}" y="${x0}" width="${t}" height="${L}" rx="${Math.round(t / 3)}" fill="#ffffff" opacity="0.92"/>
</svg>`;
}

const jobs = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["maskable-512.png", 512, { pad: 52 }],
  ["apple-touch-180.png", 180, {}],
];

for (const [file, size, opts] of jobs) {
  await sharp(Buffer.from(svg(size, opts))).png().toFile(`${OUT}/${file}`);
  console.log("wrote", `${OUT}/${file}`);
}
