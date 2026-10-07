/**
 * Light "haptic-style" confirmation. Uses the Vibration API where available (Android);
 * iOS Safari doesn't expose haptics to the web, so the visual press/scale feedback on
 * controls carries the confirmation there. Respects reduced-motion preferences.
 */
export function haptic(pattern: "tap" | "success" | "warning" = "tap") {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const ms = pattern === "tap" ? 8 : pattern === "success" ? [10, 40, 12] : [30, 60, 30];
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Unsupported — ignore.
  }
}
