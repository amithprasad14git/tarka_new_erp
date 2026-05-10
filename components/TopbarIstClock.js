"use client";

// Generic/shared file used across modules.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Live clock for the dashboard topbar — always Indian Standard Time (Asia/Kolkata),
 * independent of the visitor's system timezone.
 */
import { useEffect, useState } from "react";

const IST = "Asia/Kolkata";

/** Visible label: weekday + date (IST), comma, then 12h time with seconds (IST). */
function formatIstTopbarLabel(d) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).formatToParts(d);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const datePart = `${weekday}, ${day} ${month}`;
  const timePart = new Intl.DateTimeFormat("en-US", {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
  return `🕒 ${datePart}, ${timePart}`;
}

/** ISO-like IST instant for <time dateTime> (calendar components in Asia/Kolkata). */
function istDateTimeAttr(d) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const v = {};
  for (const p of parts) {
    if (p.type !== "literal") v[p.type] = p.value;
  }
  if (!v.year || !v.month || !v.day || v.hour == null) return "";
  return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}:${v.second}`;
}

export default function TopbarIstClock() {
  const [mounted, setMounted] = useState(false);
  const [label, setLabel] = useState("");
  const [dateTimeAttr, setDateTimeAttr] = useState("");

  useEffect(() => {
    setMounted(true);

    function tick() {
      const now = new Date();
      setLabel(formatIstTopbarLabel(now));
      setDateTimeAttr(istDateTimeAttr(now));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!mounted) {
    return (
      <div
        className="topbar-ist-clock topbar-ist-clock--placeholder"
        aria-hidden="true"
      >
        <span className="topbar-ist-clock-text">🕒 —</span>
      </div>
    );
  }

  return (
    <time
      className="topbar-ist-clock"
      dateTime={dateTimeAttr || undefined}
      title="Indian Standard Time (IST) · UTC+5:30"
      aria-live="off"
      aria-atomic="true"
    >
      <span className="topbar-ist-clock-text">{label}</span>
    </time>
  );
}
