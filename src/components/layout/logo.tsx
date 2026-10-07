import brand from "@/lib/brand-mark.json";
import { cn } from "@/lib/utils";

const { box, d } = brand.mark;
const GLYPH_H = box.y2 - box.y1;
const GLYPH_W = box.x2 - box.x1;
const DOT = GLYPH_H * 0.17;
const GAP = GLYPH_H * 0.07;
const PAD = GLYPH_H * 0.5; // glyph is half the tile height, as in the app icon
const TILE = GLYPH_H + PAD * 2;
const CONTENT_W = GLYPH_W + GAP + DOT;

/** The app icon in miniature: white "s" + mint full stop on the brand gradient. */
export function BrandMark({ className }: { className?: string }) {
  const left = (TILE - CONTENT_W) / 2;
  return (
    <svg viewBox={`0 0 ${TILE} ${TILE}`} aria-hidden className={cn("size-8 shrink-0 rounded-[22.5%] shadow-sm", className)}>
      <defs>
        <linearGradient id="brand-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d5dfc" />
          <stop offset="1" stopColor="#3b2fc9" />
        </linearGradient>
      </defs>
      <rect width={TILE} height={TILE} fill="url(#brand-g)" />
      <path transform={`translate(${left - box.x1} ${PAD - box.y1})`} d={d} fill="#fff" />
      <circle cx={left + GLYPH_W + GAP + DOT / 2} cy={PAD + GLYPH_H - DOT / 2} r={DOT / 2} fill="#6ee7b7" />
    </svg>
  );
}

/** "spend." wordmark in Bricolage Grotesque, with the mark. */
export function Logo({ className, withWordmark = true, size = "md" }: { className?: string; withWordmark?: boolean; size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <span className={cn("inline-flex items-center", lg ? "gap-3" : "gap-2", className)}>
      <BrandMark className={lg ? "size-12" : undefined} />
      {withWordmark ? (
        <span aria-hidden className={cn("font-brand leading-none font-extrabold tracking-[-0.03em]", lg ? "text-[2.4rem]" : "text-[1.4rem]")}>
          spend<span className="text-emerald-400">.</span>
        </span>
      ) : null}
      <span className="sr-only">Spend</span>
    </span>
  );
}
