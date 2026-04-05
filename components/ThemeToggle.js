"use client";

/**
 * Light/dark theme: writes `data-theme` on `<html>` and persists choice in `localStorage` (`erp-theme`).
 */
import { useEffect, useState } from "react";

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/** Sun/moon icon toggle; persists `erp-theme` on `<html data-theme>`. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load theme from localStorage only on the client (avoid hydration mismatch).
    setMounted(true);
    const saved = localStorage.getItem("erp-theme") || "light";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  function toggle() {
    // Toggle theme and persist preference.
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("erp-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  if (!mounted) {
    return (
      <button type="button" className="icon-btn icon-btn-ghost" aria-label="Theme" disabled>
        <MoonIcon />
      </button>
    );
  }

  return (
    <button
      type="button"
      className="icon-btn icon-btn-ghost"
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      title={theme === "light" ? "Dark mode" : "Light mode"}
    >
      {theme === "light" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
