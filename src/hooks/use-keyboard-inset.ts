"use client";

import { useEffect, useState } from "react";

export interface KeyboardInset {
  /** Distance from the layout viewport's bottom edge to the top of the keyboard, in px. */
  bottom: number;
  /** Height of the area left visible above the keyboard, in px. */
  height: number;
}

/** Anything smaller is browser-toolbar jitter, not an on-screen keyboard. */
const MIN_KEYBOARD_HEIGHT = 120;

/**
 * Tracks the on-screen keyboard via the visual viewport (`null` while it's closed).
 *
 * iOS Safari doesn't resize the layout viewport when the keyboard opens, so anything pinned
 * with `position: fixed; bottom: 0` — like a bottom sheet — ends up behind the keyboard and
 * the field being typed into scrolls out of sight. While enabled, this also sets
 * `data-keyboard` on <html> so footers can drop their home-indicator padding (`keyboard:`).
 */
export function useKeyboardInset(enabled: boolean): KeyboardInset | null {
  const [inset, setInset] = useState<KeyboardInset | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!enabled || !viewport) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const covered = window.innerHeight - viewport.height;
        // Pinch-zoom also shrinks the visual viewport; only react to a keyboard.
        if (covered < MIN_KEYBOARD_HEIGHT || viewport.scale > 1.01) {
          delete root.dataset.keyboard;
          setInset(null);
          return;
        }
        root.dataset.keyboard = "";
        setInset((prev) => {
          const next = {
            bottom: Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)),
            height: Math.round(viewport.height),
          };
          return prev && prev.bottom === next.bottom && prev.height === next.height ? prev : next;
        });
      });
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      delete root.dataset.keyboard;
    };
  }, [enabled]);

  return enabled ? inset : null;
}
