// src/ThemeNav.jsx
// Shared navigation bar used by every page.
// Includes theme toggle + custom language picker (powered by Google Translate).

import { useState, useEffect, useRef } from "react";
import { useTheme } from "./theme.js";
import { APP_NAME, GITHUB_URL } from "./config.js";

// ── Languages shown in the picker ─────────────────────────────────────────────
const LANGUAGES = [
  { code: "",    label: "English",    flag: "🇬🇧" },
  { code: "es",  label: "Español",    flag: "🇪🇸" },
  { code: "fr",  label: "Français",   flag: "🇫🇷" },
  { code: "de",  label: "Deutsch",    flag: "🇩🇪" },
  { code: "pt",  label: "Português",  flag: "🇧🇷" },
  { code: "it",  label: "Italiano",   flag: "🇮🇹" },
  { code: "nl",  label: "Nederlands", flag: "🇳🇱" },
  { code: "ru",  label: "Русский",    flag: "🇷🇺" },
  { code: "zh-CN", label: "中文",     flag: "🇨🇳" },
  { code: "ja",  label: "日本語",     flag: "🇯🇵" },
  { code: "ko",  label: "한국어",     flag: "🇰🇷" },
  { code: "ar",  label: "العربية",    flag: "🇸🇦" },
  { code: "hi",  label: "हिन्दी",     flag: "🇮🇳" },
  { code: "tr",  label: "Türkçe",     flag: "🇹🇷" },
  { code: "pl",  label: "Polski",     flag: "🇵🇱" },
];

// ── Language Picker Component ─────────────────────────────────────────────────

function LangPicker({ C }) {
  const [open,        setOpen]        = useState(false);
  const [activeLang,  setActiveLang]  = useState("");   // "" = English (original)
  const [ready,       setReady]       = useState(false); // true once GT widget is loaded
  const dropdownRef = useRef(null);

  // Poll until the Google Translate select element appears in the DOM
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.querySelector(".goog-te-combo")) {
        setReady(true);
        clearInterval(interval);
      }
    }, 300);
    // Stop polling after 15 seconds whether it loaded or not
    const timeout = setTimeout(() => clearInterval(interval), 15000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function selectLanguage(code) {
    const select = document.querySelector(".goog-te-combo");
    if (!select) return;
    select.value = code;
    select.dispatchEvent(new Event("change"));
    setActiveLang(code);
    setOpen(false);
  }

  // Don't render until the widget is ready (avoids a dead button)
  if (!ready) return null;

  const currentLang = LANGUAGES.find(l => l.code === activeLang) || LANGUAGES[0];

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Globe button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          "5px",
          background:   "transparent",
          border:       `1px solid ${open ? C.accent : C.border2}`,
          borderRadius: "6px",
          padding:      "5px 9px",
          cursor:       "pointer",
          color:        open ? C.accent : C.textMuted,
          fontSize:     "13px",
          fontFamily:   "'IBM Plex Mono', monospace",
          transition:   "all 0.2s",
          lineHeight:   1,
        }}
        className="lang-btn"
        aria-label="Select language"
        aria-expanded={open}
      >
        <span style={{ fontSize: "14px" }}>🌐</span>
        <span style={{ fontSize: "10px", letterSpacing: "0.5px" }}>
          {currentLang.flag}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:        "absolute",
          top:             "calc(100% + 8px)",
          right:           0,
          background:      C.card,
          border:          `1px solid ${C.border2}`,
          borderRadius:    "6px",
          boxShadow:       "0 8px 32px rgba(0,0,0,0.35)",
          zIndex:          200,
          minWidth:        "170px",
          overflow:        "hidden",
          fontFamily:      "'IBM Plex Mono', monospace",
        }}>
          {/* Header */}
          <div style={{
            padding:      "8px 14px",
            fontSize:     "8px",
            letterSpacing:"3px",
            color:        C.textMuted,
            borderBottom: `1px solid ${C.border}`,
          }}>
            LANGUAGE
          </div>

          {/* Language list */}
          <div style={{ maxHeight: "260px", overflowY: "auto" }}>
            {LANGUAGES.map(lang => {
              const isActive = lang.code === activeLang;
              return (
                <button
                  key={lang.code || "en-orig"}
                  onClick={() => selectLanguage(lang.code)}
                  style={{
                    display:         "flex",
                    alignItems:      "center",
                    gap:             "10px",
                    width:           "100%",
                    background:      isActive ? C.accentDim : "transparent",
                    border:          "none",
                    borderBottom:    `1px solid ${C.border}`,
                    padding:         "9px 14px",
                    cursor:          "pointer",
                    textAlign:       "left",
                    fontFamily:      "inherit",
                    transition:      "background 0.15s",
                  }}
                  className="lang-option"
                >
                  <span style={{ fontSize: "15px", flexShrink: 0 }}>{lang.flag}</span>
                  <span style={{
                    fontSize:     "12px",
                    color:        isActive ? C.accent : C.textSub,
                    fontWeight:   isActive ? "700" : "400",
                    letterSpacing:"0.3px",
                  }}>
                    {lang.label}
                  </span>
                  {isActive && (
                    <span style={{ marginLeft: "auto", color: C.accent, fontSize: "11px" }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer note */}
          <div style={{
            padding:      "7px 14px",
            fontSize:     "9px",
            color:        C.textFaint,
            borderTop:    `1px solid ${C.border}`,
            lineHeight:   "1.5",
          }}>
            Powered by Google Translate
          </div>
        </div>
      )}
    </div>
  );
}

// ── Nav Component ─────────────────────────────────────────────────────────────

export default function ThemeNav({ links = [], scrolled: externalScrolled = null }) {
  const { C, toggle, isDark } = useTheme();
  const [scrolled,   setScrolled]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isScrolled = externalScrolled !== null ? externalScrolled : scrolled;

  useEffect(() => {
    if (externalScrolled !== null) return;
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, [externalScrolled]);

  const S = makeNavStyles(C);

  return (
    <>
      <nav style={{ ...S.nav, ...(isScrolled ? S.navScrolled : {}) }}>
        <a href="/" style={S.logo}>
          {APP_NAME.split(".")[0]}
          <span style={{ color: C.accent }}>.{APP_NAME.split(".")[1]}</span>
        </a>

        <div style={S.right}>
          {/* Desktop nav links */}
          {links.map(l => (
            <a key={l.href} href={l.href} style={S.link} className="tnav-link">{l.label}</a>
          ))}

          {/* Language picker */}
          <LangPicker C={C} />

          {/* Theme toggle */}
          <button
            style={{ ...S.toggle, background: C.toggleBg }}
            onClick={toggle}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="tnav-toggle">
            {C.toggleIcon}
          </button>

          {/* Mobile hamburger */}
          <button
            style={S.hamburger}
            onClick={() => setMobileOpen(o => !o)}
            className="tnav-hamburger"
            aria-label="Menu">
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div style={{ ...S.drawer, background: C.navBg, borderBottom: `1px solid ${C.border}` }}>
          {links.map(l => (
            <a key={l.href} href={l.href} style={S.drawerLink}
              onClick={() => setMobileOpen(false)}>{l.label}</a>
          ))}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" style={S.drawerLink}>GitHub ↗</a>
        </div>
      )}
    </>
  );
}

// ── Nav Styles ────────────────────────────────────────────────────────────────

function makeNavStyles(C) {
  return {
    nav: {
      position:     "sticky", top: 0, zIndex: 100,
      display:      "flex", justifyContent: "space-between", alignItems: "center",
      padding:      "0 32px", height: "60px",
      background:   "transparent", transition: "all 0.3s",
      borderBottom: "1px solid transparent",
    },
    navScrolled: {
      background:      C.navBg,
      borderBottomColor: C.border,
      backdropFilter:  "blur(12px)",
    },
    logo: {
      fontSize:    "17px", fontWeight: "800", color: C.text,
      textDecoration: "none", letterSpacing: "-0.5px",
      fontFamily:  "'IBM Plex Mono', monospace",
    },
    right:     { display: "flex", alignItems: "center", gap: "12px" },
    link: {
      color:          C.textMuted, textDecoration: "none",
      fontSize:       "12px", letterSpacing: "1px",
      transition:     "color 0.2s", fontFamily: "'IBM Plex Mono', monospace",
    },
    toggle: {
      border:       `1px solid ${C.border2}`, borderRadius: "6px",
      padding:      "5px 9px", cursor: "pointer", fontSize: "13px",
      lineHeight:   1, transition: "all 0.2s",
    },
    hamburger: {
      display:      "none", background: "transparent",
      border:       `1px solid ${C.border2}`, color: C.textSub,
      fontSize:     "15px", padding: "4px 10px", cursor: "pointer",
      borderRadius: "3px", fontFamily: "inherit",
    },
    drawer: {
      position:       "fixed", top: "60px", left: 0, right: 0,
      zIndex:         99, padding: "12px 20px",
      display:        "flex", flexDirection: "column", gap: "4px",
      backdropFilter: "blur(12px)",
    },
    drawerLink: {
      color:          C.textSub, textDecoration: "none",
      padding:        "10px 8px", fontSize: "13px",
      fontFamily:     "'IBM Plex Mono', monospace",
      borderBottom:   `1px solid ${C.border}`,
    },
  };
}

// ── Shared global CSS ─────────────────────────────────────────────────────────
// Import once per page via: import { themeCSS } from "./ThemeNav.jsx"

export function themeCSS(C) {
  return `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700;800&family=DM+Serif+Display:ital@0;1&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: ${C.bg}; color: ${C.text}; font-family: 'IBM Plex Mono', 'Courier New', monospace; transition: background 0.2s, color 0.2s; }

    .tnav-link:hover      { color: ${C.accent} !important; }
    .tnav-toggle:hover    { border-color: ${C.accent} !important; }
    .tnav-hamburger:hover { color: ${C.accent} !important; border-color: ${C.accent} !important; }
    .lang-btn:hover       { border-color: ${C.accent} !important; color: ${C.accent} !important; }
    .lang-option:hover    { background: ${C.accentDim} !important; }

    @media (max-width: 640px) {
      .tnav-hamburger { display: block !important; }
      .tnav-link      { display: none !important; }
      nav             { padding: 0 16px !important; }
    }

    ::-webkit-scrollbar       { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: ${C.bg}; }
    ::-webkit-scrollbar-thumb { background: ${C.scrollThumb}; border-radius: 3px; }
    ::selection { background: ${C.accentDim}; }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;
}
