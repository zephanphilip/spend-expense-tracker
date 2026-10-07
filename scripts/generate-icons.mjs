// Renders the PWA / Apple touch icons (and the favicon) from the Spend mark.
// Run: node scripts/generate-icons.mjs
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { gradientDef, markGlyph } from "./brand.mjs";

const outDir = fileURLToPath(new URL("../public/icons/", import.meta.url));

/** `inset` shrinks the mark so maskable icons survive circular crops. */
function svg({ size, inset = 0, rounded = true }) {
  const r = rounded ? size * 0.225 : 0;
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${gradientDef()}</defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>
  ${markGlyph({ size, scale: 0.5 * (1 - inset * 2) })}
</svg>`);
}

await mkdir(outDir, { recursive: true });
const jobs = [
  ["icon-192.png", { size: 192 }],
  ["icon-512.png", { size: 512 }],
  ["maskable-512.png", { size: 512, inset: 0.12, rounded: false }],
  ["apple-touch-icon.png", { size: 180, rounded: false }],
  ["favicon-32.png", { size: 32 }],
];
for (const [name, opts] of jobs) {
  await sharp(svg(opts)).png().toFile(`${outDir}${name}`);
  console.log("wrote", name);
}
