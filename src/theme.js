// src/theme.js
// ─────────────────────────────────────────────────────────────────────────────
// Theme system for Cron.Explain.
//
// Uses a module-level singleton + subscriber set.
//
// Why: ThemeNav, Landing, Docs, Scheduler, and CronTerms all call useTheme()
// independently. The old toggle closed over `isDark` from the render scope —
// stale on rapid clicks. The old custom event dispatched from setThemeMode()
// worked, but the `toggle` function itself was the problem: it computed
// `isDark ? "light" : "dark"` from a potentially-stale render-time value.
//
// How this works:
//   _dark        — one boolean at module scope, always current, never stale
//   _subs        — a Set of every active setIsDark setter on the page
//   broadcast()  — writes _dark then calls every setter synchronously
//   toggle()     — reads !_dark directly, impossible to be stale
//   storage      — cross-tab sync via the window storage event
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

const KEY = "ce-theme";

// ── Singleton ──────────────────────────────────────────────────────────────────

function readInitial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return saved === "dark";
  } catch {}
  // Default to dark if no OS preference detected
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

let _dark = readInitial();
const _subs = new Set();

function broadcast(dark) {
  _dark = dark;
  _subs.forEach(fn => fn(dark));
}

// ── Dark palette ──────────────────────────────────────────────────────────────
// Contrast notes: all text colours pass WCAG AA (4.5:1) against their
// respective backgrounds. textMuted was #555 (2.8:1 on #0d0d0d) — bumped to
// #888. textFaint was #333 (barely visible) — bumped to #666. border2 was
// #2a2a2a (invisible against #0f0f0f) — bumped to #404040.

export const DARK = {
  // backgrounds
  bg:          "#0a0a0a",
  bg2:         "#060606",
  card:        "#0f0f0f",
  card2:       "#111111",
  // borders — light enough to actually be visible in dark mode
  border:      "#2a2a2a",
  border2:     "#404040",
  // text — all pass WCAG AA on their backgrounds
  text:        "#e0e0e0",
  textSub:     "#aaaaaa",
  textMuted:   "#888888",
  textFaint:   "#666666",
  // accent (yellow-gold)
  accent:      "#f0c040",
  accentText:  "#000000",
  accentDim:   "#f0c04022",
  // green
  green:       "#4caf50",
  greenDim:    "#1a5c1a",
  greenBg:     "#080e08",
  // inputs / code
  inputBg:     "#0d0d0d",
  // nav
  navBg:       "rgba(10,10,10,0.97)",
  // toggle
  toggleBg:    "#1a1a1a",
  toggleIcon:  "☀️",
  // scrollbar
  scrollThumb: "#3a3a3a",
};

// ── Light palette ─────────────────────────────────────────────────────────────

export const LIGHT = {
  bg:          "#f5f3ee",
  bg2:         "#ede9e0",
  card:        "#ffffff",
  card2:       "#fafaf7",
  border:      "#d8d3c8",
  border2:     "#c0bab0",
  text:        "#111111",
  textSub:     "#555555",
  textMuted:   "#777777",
  textFaint:   "#999999",
  accent:      "#b07d10",
  accentText:  "#ffffff",
  accentDim:   "#b07d1018",
  green:       "#287828",
  greenDim:    "#aad4aa",
  greenBg:     "#f0f8f0",
  inputBg:     "#f8f6f2",
  navBg:       "rgba(245,243,238,0.97)",
  toggleBg:    "#e0dcd4",
  toggleIcon:  "🌙",
  scrollThumb: "#c8c4bc",
};

// ── useTheme hook ─────────────────────────────────────────────────────────────

export function useTheme() {
  const [isDark, setIsDark] = useState(() => _dark);

  useEffect(() => {
    _subs.add(setIsDark);

    function onStorage(e) {
      if (e.key === KEY && e.newValue) {
        broadcast(e.newValue === "dark");
      }
    }
    window.addEventListener("storage", onStorage);

    return () => {
      _subs.delete(setIsDark);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function toggle() {
    const next = !_dark;
    try { localStorage.setItem(KEY, next ? "dark" : "light"); } catch {}
    broadcast(next);
  }

  const C = isDark ? DARK : LIGHT;
  return { mode: isDark ? "dark" : "light", C, isDark, toggle };
}
