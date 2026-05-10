"use client";

// Generic/shared file used across modules.
// Occasional ambient micro-icons: one play per burst, randomized idle gap (React timers).

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, useState } from "react";

const GLYPHS = ["\u2726", "\u2726", "\u2726", "\u2726", "\u2726", "\u2726", "\u2726", "\u2726"];

/** Light-theme mixes (readable on pale header). */
const PALETTE_LIGHT = ["#ffbb33", "#ff3333", "#09aff6", "#53c653", "#7d54f8", "#cc33ff"];

/** Slightly brighter for dark header. */
const PALETTE_DARK = ["#ffcc66", "#ff8080", "#38bdf8", "#8cd98c", "#a78bfa", "#d966ff"];

const MOTIONS = ["fg", "md", "bk", "x"];

const ACTIVE_MS_MIN = 10000;
const ACTIVE_MS_MAX = 15000;
const IDLE_MS_MIN = 60000;
const IDLE_MS_MAX = 120000;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCycle(theme) {
  const dark = theme === "dark";
  const palette = dark ? PALETTE_DARK : PALETTE_LIGHT;

  const count = 5 + Math.floor(Math.random() * 4);
  const chosen = shuffle(GLYPHS).slice(0, count);

  const cols = shuffle(palette);

  const activeMs =
    ACTIVE_MS_MIN + Math.floor(Math.random() * (ACTIVE_MS_MAX - ACTIVE_MS_MIN + 1));

  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  const items = chosen.map((char, i) => {
    const motion = MOTIONS[Math.floor(Math.random() * MOTIONS.length)];
    const topPct = 34 + Math.random() * 30;
    const fontSizePx = 12 + Math.round(Math.random() * 6);
    const durSec =
      Math.round(((activeMs / 1000) * (0.58 + Math.random() * 0.38)) * 1000) / 1000;
    const delaySec = -Math.random() * Math.min(4.2, durSec * 0.45);
    const color = cols[i % cols.length];

    return {
      id: `${runId}_${i}_${char}`,
      char,
      motion,
      topPct,
      fontSizePx,
      durSec,
      delaySec,
      color,
    };
  });

  return { runId, activeMs, items };
}

function buildIdleDecor(theme) {
  const dark = theme === "dark";
  const palette = dark ? PALETTE_DARK : PALETTE_LIGHT;
  const pair = shuffle([...GLYPHS]);
  const g0 = pair[0];
  const g1 = pair[Math.min(1, pair.length - 1)];
  const rid = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  return [
    {
      id: `wisp_${rid}_a`,
      char: g0,
      leftPct: 14 + Math.random() * 18,
      topPct: 42 + Math.random() * 16,
      color: palette[Math.floor(Math.random() * palette.length)],
      fontSizePx: 10 + Math.round(Math.random() * 2),
    },
    {
      id: `wisp_${rid}_b`,
      char: g1,
      leftPct: 62 + Math.random() * 20,
      topPct: 36 + Math.random() * 20,
      color: palette[Math.floor(Math.random() * palette.length)],
      fontSizePx: 10 + Math.round(Math.random() * 2),
    },
  ];
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

function subscribeTheme(onChange) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function snapshotTheme() {
  return document.documentElement.getAttribute("data-theme") || "light";
}

function useHtmlTheme() {
  return useSyncExternalStore(subscribeTheme, snapshotTheme, () => "light");
}

/**
 * Ambient micro-icons: single play per burst, then long idle; never `animation: infinite`.
 */
export default function TopbarMicroFloatLane() {
  const reducedTheme = useHtmlTheme();
  const reduced = useReducedMotion();

  const [phase, setPhase] = useState("active");
  const [cycle, setCycle] = useState(null);
  const [idleDecor, setIdleDecor] = useState([]);

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
      activeTimerRef.current = setTimeout(() => {
        setIdleDecor(buildIdleDecor(snapshotTheme()));
        setPhase("idle");
      }, cycle.activeMs);
      return () => {
        if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
      };
    }

    if (phase === "idle") {
      const idleMs = IDLE_MS_MIN + Math.floor(Math.random() * (IDLE_MS_MAX - IDLE_MS_MIN + 1));
      idleTimerRef.current = setTimeout(() => {
        setCycle(buildCycle(snapshotTheme()));
        setPhase("active");
      }, idleMs);
      return () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      };
    }

    return undefined;
  }, [phase, cycle, reduced]);

  if (reduced) {
    const decor = buildIdleDecor(reducedTheme);
    return (
      <div className="topbar-micro-float-lane topbar-micro-float-lane--reduced" aria-hidden="true">
        {decor.map((w) => (
          <span
            key={w.id}
            className="topbar-micro-idle-wisp"
            style={{
              left: `${w.leftPct}%`,
              top: `${w.topPct}%`,
              color: w.color,
              fontSize: `${w.fontSizePx}px`,
            }}
          >
            {w.char}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`topbar-micro-float-lane topbar-micro-float-lane--${phase}`}
      aria-hidden="true"
    >
      {phase === "idle" &&
        idleDecor.map((w) => (
          <span
            key={w.id}
            className="topbar-micro-idle-wisp"
            style={{
              left: `${w.leftPct}%`,
              top: `${w.topPct}%`,
              color: w.color,
              fontSize: `${w.fontSizePx}px`,
            }}
          >
            {w.char}
          </span>
        ))}

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
