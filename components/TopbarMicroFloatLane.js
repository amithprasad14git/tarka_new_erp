"use client";

/**
 * TOPBAR SPARKLE LANE — READ THIS FIRST
 * =====================================
 * After you log in, the thin strip between your greeting and the clock can show small
 * sparkles that drift slowly across. They are NOT random anymore: every burst uses the
 * same paths, colors order, and timing so it feels steady and calm.
 *
 * HOW THE CYCLE WORKS (two timers)
 * --------------------------------
 * 1) BURST — sparkles appear and play their drift animation for BURST_DURATION_MS.
 * 2) IDLE — the strip is empty for IDLE_GAP_MS, then step 1 runs again.
 *
 * WHERE TO CHANGE THE WAIT TIMES (milliseconds = 1/1000 of a second)
 * --------------------------------------------------------------------
 * - Want each burst to last longer on screen?     → raise BURST_DURATION_MS
 * - Want longer quiet between bursts?             → raise IDLE_GAP_MS
 * - Want bursts back sooner?                      → lower IDLE_GAP_MS
 *
 * Each sparkle’s drift speed is ICON_DRIFT_SECONDS (seconds). Higher = slower, calmer.
 * The curved paths themselves live in `app/globals.css` (search for `topbarMicroMotion`).
 */

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  TIMER KNOBS — edit these numbers to speed up or slow down the experience  */
/* -------------------------------------------------------------------------- */

/** How long ONE BURST stays on screen before we clear it (empty lane). Was ~10–15s; now a bit longer for a calmer feel. */
const BURST_DURATION_MS = 16000;

/** How long NOTHING shows until the next burst. 90_000 = 90 seconds = 1½ minutes. */
const IDLE_GAP_MS = 90000;

/** How many seconds each sparkle takes to drift across (same every time). Was roughly ~6–14s varying; now one slow value. */
const ICON_DRIFT_SECONDS = 14;

/* -------------------------------------------------------------------------- */

/** Sparkle character (same for every icon in a burst). */
const GLYPH = "\u2726";

/** Light-theme colors (used in fixed order, cycling). */
const PALETTE_LIGHT = ["#ffbb33", "#ff3333", "#09aff6", "#53c653", "#7d54f8", "#cc33ff"];

/** Dark-theme colors (used in fixed order, cycling). */
const PALETTE_DARK = ["#ffcc66", "#ff8080", "#38bdf8", "#8cd98c", "#a78bfa", "#d966ff"];

/**
 * Fixed motion “tracks” (must match CSS class names in globals.css):
 * fg = front path, md = middle, bk = back, x = alternate curve — same order every burst.
 */
const MOTION_SEQUENCE = ["fg", "md", "bk", "x", "fg", "md", "bk"];

/** Fixed vertical positions (% inside the lane) so sparkles don’t jump to random heights. */
const TOP_PERCENT_SEQUENCE = [40, 43, 46, 41, 44, 47, 42];

/**
 * When each sparkle starts (seconds). Negative = already partway through its path when
 * the burst begins, so they overlap gently instead of popping in one-by-one.
 */
const DELAY_STAGGER_SEC = [-3.5, -3, -2.5, -2, -1.5, -1, -0.5];

function buildCycle(theme) {
  const dark = theme === "dark";
  const palette = dark ? PALETTE_DARK : PALETTE_LIGHT;
  const runId = `burst_${Date.now()}`;

  const items = MOTION_SEQUENCE.map((motion, i) => ({
    id: `${runId}_${i}`,
    char: GLYPH,
    motion,
    topPct: TOP_PERCENT_SEQUENCE[i % TOP_PERCENT_SEQUENCE.length],
    fontSizePx: 13,
    durSec: ICON_DRIFT_SECONDS,
    delaySec: DELAY_STAGGER_SEC[i % DELAY_STAGGER_SEC.length],
    color: palette[i % palette.length],
  }));

  return { runId, activeMs: BURST_DURATION_MS, items };
}

function subscribeReduced(onChange) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function snapshotReduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** @returns {boolean} */
function useReducedMotion() {
  return useSyncExternalStore(subscribeReduced, snapshotReduced, () => false);
}

function snapshotTheme() {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") || "light";
}

/**
 * Sparkle lane: one calm burst, then empty, then repeat.
 * If the user asked the OS to “reduce motion”, we show an empty lane (no animation).
 */
export default function TopbarMicroFloatLane() {
  const reduced = useReducedMotion();

  const [phase, setPhase] = useState("active");
  const [cycle, setCycle] = useState(null);

  const activeTimerRef = useRef(null);
  const idleTimerRef = useRef(null);

  useLayoutEffect(() => {
    if (reduced) return;
    setCycle((c) => c ?? buildCycle(snapshotTheme()));
  }, [reduced]);

  useEffect(() => {
    if (reduced) {
      if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      return undefined;
    }

    if (!cycle) return undefined;

    if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    if (phase === "active") {
      // When this timer fires, the burst is over → hide icons until the idle timer finishes.
      activeTimerRef.current = setTimeout(() => {
        setPhase("idle");
      }, cycle.activeMs);
      return () => {
        if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
      };
    }

    if (phase === "idle") {
      // Quiet gap: length is IDLE_GAP_MS at the top of this file.
      idleTimerRef.current = setTimeout(() => {
        setCycle(buildCycle(snapshotTheme()));
        setPhase("active");
      }, IDLE_GAP_MS);
      return () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      };
    }

    return undefined;
  }, [phase, cycle, reduced]);

  if (reduced) {
    return <div className="topbar-micro-float-lane topbar-micro-float-lane--reduced" aria-hidden="true" />;
  }

  return (
    <div
      className={`topbar-micro-float-lane topbar-micro-float-lane--${phase}`}
      aria-hidden="true"
    >
      {phase === "active" &&
        cycle &&
        cycle.items.map((it) => (
          <span
            key={it.id}
            className={`topbar-micro-icon topbar-micro-motion-${it.motion}`}
            style={{
              top: `${it.topPct}%`,
              color: it.color,
              fontSize: `${it.fontSizePx}px`,
              animationDuration: `${it.durSec}s`,
              animationDelay: `${it.delaySec}s`,
            }}
          >
            <span className="topbar-micro-char">{it.char}</span>
          </span>
        ))}
    </div>
  );
}
