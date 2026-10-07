// Renders iOS launch images (apple-touch-startup-image) for current iPhones, light and dark.
// Run: node scripts/generate-splash.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { COLORS, gradientDef, markGlyph, wordmark } from "./brand.mjs";

const outDir = fileURLToPath(new URL("../public/splash/", import.meta.url));
// [css width, css height, device pixel ratio] — portrait.
export const DEVICES = [
  [440, 956, 3], // 16 Pro Max
  [402, 874, 3], // 16 Pro
  [430, 932, 3], // 15/16 Plus, 14/15 Pro Max
  [393, 852, 3], // 14/15 Pro, 15, 16
  [428, 926, 3], // 12–14 Pro Max / Plus
  [390, 844, 3], // 12–14
  [375, 812, 3], // X/XS/11 Pro/12–13 mini
  [414, 896, 3], // XS Max / 11 Pro Max
  [414, 896, 2], // XR / 11
  [375, 667, 2], // SE 2/3, 8
];

function svg(w, h, dark) {
  const s = Math.round(Math.min(w, h) * 0.22);
  const x = Math.round((w - s) / 2);
  const y = Math.round((h - s) / 2 - h * 0.04);
  const bg = dark ? "#101116" : "#fdfdfe";
  const textHeight = s * 0.36;
  const probe = wordmark({ x: 0, y: 0, height: textHeight, color: "" });
  const word = wordmark({ x: (w - probe.width) / 2, y: y + s + s * 0.28, height: textHeight, color: dark ? COLORS.inkDark : COLORS.ink });
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>${gradientDef()}</defs>
  <rect width="${w}" height="${h}" fill="${bg}"/>
  <rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.225}" fill="url(#g)"/>
  ${markGlyph({ x, y, size: s })}
  ${word.svg}
</svg>`);
}

await mkdir(outDir, { recursive: true });
const entries = [];
for (const [cw, ch, dpr] of DEVICES) {
  for (const dark of [false, true]) {
    const file = `splash-${cw * dpr}x${ch * dpr}${dark ? "-dark" : ""}.png`;
    await sharp(svg(cw * dpr, ch * dpr, dark)).png({ compressionLevel: 9 }).toFile(`${outDir}${file}`);
    entries.push({
      url: `/splash/${file}`,
      media: `(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait) and (prefers-color-scheme: ${dark ? "dark" : "light"})`,
    });
  }
}
await writeFile(fileURLToPath(new URL("../src/app/splash-screens.json", import.meta.url)), JSON.stringify(entries, null, 2) + "\n");
console.log(`wrote ${entries.length} splash screens`);
