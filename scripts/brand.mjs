// Shared drawing for the Spend app icon, splash screens and anything else rasterised.
// Glyph outlines come from src/lib/brand-mark.json (Bricolage Grotesque ExtraBold, SIL OFL),
// so rendering never depends on fonts installed on the machine.
import { readFileSync } from "node:fs";

const brand = JSON.parse(readFileSync(new URL("../src/lib/brand-mark.json", import.meta.url), "utf8"));

export const COLORS = {
  from: "#6d5dfc",
  to: "#3b2fc9",
  accent: "#6ee7b7",
  ink: "#16171c",
  inkDark: "#f4f4f6",
};

export const gradientDef = (id = "g") =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${COLORS.from}"/><stop offset="1" stop-color="${COLORS.to}"/></linearGradient>`;

/**
 * The mark: a white lowercase "s" with a mint full stop, centred in a `size` square at
 * (x, y). `scale` is the glyph height as a share of the square.
 */
export function markGlyph({ x = 0, y = 0, size, scale = 0.5 }) {
  const { box, d } = brand.mark;
  const gh = box.y2 - box.y1;
  const gw = box.x2 - box.x1;
  const k = (size * scale) / gh;
  const dot = gh * 0.17; // dot diameter in glyph units
  const gap = gh * 0.07;
  const totalW = (gw + gap + dot) * k;
  const left = x + (size - totalW) / 2;
  const top = y + (size - gh * k) / 2;
  const cx = left + (gw + gap + dot / 2) * k;
  const cy = top + (gh - dot / 2) * k;
  return `
  <path transform="translate(${left - box.x1 * k} ${top - box.y1 * k}) scale(${k})" d="${d}" fill="#fff"/>
  <circle cx="${cx}" cy="${cy}" r="${(dot / 2) * k}" fill="${COLORS.accent}"/>`;
}

/** The wordmark "spend" + accent dot, `height` tall (x-height to baseline), at (x, y) top-left. */
export function wordmark({ x, y, height, color }) {
  const { box, d } = brand.wordmark;
  const k = height / (box.y2 - box.y1);
  const width = (box.x2 - box.x1) * k;
  const dot = (box.y2 - box.y1) * 0.2 * k;
  return {
    width: width + dot * 1.35,
    svg: `
  <path transform="translate(${x - box.x1 * k} ${y - box.y1 * k}) scale(${k})" d="${d}" fill="${color}"/>
  <circle cx="${x + width + dot * 0.85}" cy="${y + height - dot * 0.5 - (box.y2 - 100) * k}" r="${dot / 2}" fill="${COLORS.accent}"/>`,
  };
}
