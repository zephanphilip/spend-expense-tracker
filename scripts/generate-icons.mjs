// Renders the PWA / Apple touch icons from an inline SVG. Run: node scripts/generate-icons.mjs
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const outDir = fileURLToPath(new URL("../public/icons/", import.meta.url));

/** `inset` shrinks the glyph so maskable icons survive circular crops. */
function svg({ size, inset = 0, rounded = true }) {
  const r = rounded ? size * 0.225 : 0;
  const scale = (size * (1 - inset * 2)) / 24;
  const offset = size * inset;
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5b4ff0"/>
      <stop offset="1" stop-color="#3730a3"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#fff"
     stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 6.5v11h8.5"/><path d="M11.5 10h5"/><path d="M11.5 13.5h3.5"/>
  </g>
</svg>`);
}

await mkdir(outDir, { recursive: true });
const jobs = [
  ["icon-192.png", { size: 192 }],
  ["icon-512.png", { size: 512 }],
  ["maskable-512.png", { size: 512, inset: 0.12, rounded: false }],
  ["apple-touch-icon.png", { size: 180, rounded: false }],
];
for (const [name, opts] of jobs) {
  await sharp(svg(opts)).png().toFile(`${outDir}${name}`);
  console.log("wrote", name);
}
