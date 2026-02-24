// src/theme.js
import { useState, useEffect } from "react";

const STORAGE_KEY = "ce-theme";

export const DARK = {
  // backgrounds
  bg:          "#0a0a0a",
  bg2:         "#060606",
  card:        "#0f0f0f",
  card2:       "#111111",
  // borders
  border:      "#1a1a1a",
  border2:     "#2a2a2a",
  // text
  text:        "#e0e0e0",
  textSub:     "#888888",
  textMuted:   "#555555",
  textFaint:   "#333333",
  // accent (yellow-gold)
  accent:      "#f0c040",
  accentText:  "#000000",  // text ON accent-colored buttons
  accentDim:   "#f0c04020",
  // green for success/runs
  green:       "#4caf50",
  greenDim:    "#1a5c1a",
  greenBg:     "#080e08",
  // inputs / code
  inputBg:     "#0d0d0d",
  // nav
  navBg:       "rgba(10,10,10,0.97)",
  // toggle button
  toggleBg:    "#1a1a1a",
  toggleIcon:  "☀️",
  // scrollbar
  scrollThumb: "#2a2a2a",
};

export const LIGHT = {
  bg:          "#f5f3ee",
  bg2:         "#ede9e0",
  card:        "#ffffff",
  card2:       "#fafaf7",
  border:      "#d8d3c8",
  border2:     "#c0bab0",
  text:        "#111111",
  textSub:     "#555555",
  textMuted:   "#888888",
  textFaint:   "#bbbbbb",
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

// ── Read / write ──────────────────────────────────────────────────────────────

export function getThemeMode() {
  try { return localStorage.getItem(STORAGE_KEY) || "dark"; } catch { return "dark"; }
}

export function setThemeMode(mode) {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  // Dispatch event so all components on the page (and other open tabs via storage event) update
  window.dispatchEvent(new CustomEvent("themechange", { detail: mode }));
}

// ── React hook ────────────────────────────────────────────────────────────────

export function useTheme() {
  const [mode, setMode] = useState(() => getThemeMode());

  useEffect(() => {
    // Custom event — same tab, instant
    const onCustom = (e) => setMode(e.detail);
    // Storage event — other tabs
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) setMode(e.newValue);
    };
    window.addEventListener("themechange", onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("themechange", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const isDark  = mode === "dark";
  const C       = isDark ? DARK : LIGHT;
  const toggle  = () => setThemeMode(isDark ? "light" : "dark");

  return { mode, C, isDark, toggle };
}
