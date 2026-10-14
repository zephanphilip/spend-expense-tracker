"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";

interface LocalDay {
  /** "yyyy-MM-dd" in the device's time zone. */
  key: string;
  /** A moment within that day (when it was first observed). */
  now: Date;
}

const observe = (): LocalDay => {
  const now = new Date();
  return { key: format(now, "yyyy-MM-dd"), now };
};

/**
 * The current local calendar day. Rolls over at midnight (checked every minute) and when the
 * app returns to the foreground, so views left open across a day or month boundary update.
 */
export function useLocalDay(): LocalDay {
  const [day, setDay] = useState(observe);
  useEffect(() => {
    const refresh = () => {
      const next = observe();
      setDay((prev) => (prev.key === next.key ? prev : next));
    };
    const timer = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return day;
}
