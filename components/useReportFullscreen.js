"use client";

/**
 * React hook: useReportFullscreen
 * Toggles report fullscreen mode, locks body scroll, and exits on Escape.
 * Keep module-specific business rules in lib/modules/*Client.js, not here.
 */

import { useCallback, useEffect, useState } from "react";

/**
 * Fullscreen state for report screens (body overflow + Escape to exit).
 * @returns {{ fullscreen: boolean, setFullscreen: (v: boolean) => void, toggleFullscreen: () => void }}
 */
export function useReportFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((v) => !v);
  }, []);

  useEffect(() => {
    if (!fullscreen) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  return { fullscreen, setFullscreen, toggleFullscreen };
}
