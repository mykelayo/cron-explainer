// src/ThemeNav.jsx
// Shared navigation bar used by every page.
import { useState, useEffect } from "react";
import { useTheme } from "./theme.js";
import { APP_NAME, GITHUB_URL } from "./config.js";

// links = [{ href, label }] — right-side nav links for this page
export default function ThemeNav({ links = [], scrolled: externalScrolled = null }) {
  const { C, toggle, isDark } = useTheme();
  const [scrolled, setScrolled]     = useState(false);
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
          {links.map(l => (
            <a key={l.href} href={l.href} style={S.link} className="tnav-link">{l.label}</a>
          ))}
          <button
            style={{ ...S.toggle, background: C.toggleBg }}
            onClick={toggle}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="tnav-toggle">
            {C.toggleIcon}
          </button>
          <button
            style={S.hamburger}
            onClick={() => setMobileOpen(o => !o)}
            className="tnav-hamburger"
            aria-label="Menu">
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

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

function makeNavStyles(C) {
  return {
    nav: {
      position: "sticky", top: 0, zIndex: 100,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "0 32px", height: "60px",
      background: "transparent", transition: "all 0.3s",
      borderBottom: "1px solid transparent",
    },
    navScrolled: {
      background: C.navBg,
      borderBottomColor: C.border,
      backdropFilter: "blur(12px)",
    },
    logo: {
      fontSize: "17px", fontWeight: "800", color: C.text,
      textDecoration: "none", letterSpacing: "-0.5px",
      fontFamily: "'IBM Plex Mono',monospace",
    },
    right:     { display: "flex", alignItems: "center", gap: "20px" },
    link: {
      color: C.textMuted, textDecoration: "none",
      fontSize: "12px", letterSpacing: "1px",
      transition: "color 0.2s", fontFamily: "'IBM Plex Mono',monospace",
    },
    toggle: {
      border: `1px solid ${C.border2}`, borderRadius: "6px",
      padding: "5px 9px", cursor: "pointer", fontSize: "13px",
      lineHeight: 1, transition: "all 0.2s",
    },
    hamburger: {
      display: "none", background: "transparent",
      border: `1px solid ${C.border2}`, color: C.textSub,
      fontSize: "15px", padding: "4px 10px", cursor: "pointer",
      borderRadius: "3px", fontFamily: "inherit",
    },
    drawer: {
      position: "fixed", top: "60px", left: 0, right: 0,
      zIndex: 99, padding: "12px 20px",
      display: "flex", flexDirection: "column", gap: "4px",
      backdropFilter: "blur(12px)",
    },
    drawerLink: {
      color: C.textSub, textDecoration: "none",
      padding: "10px 8px", fontSize: "13px",
      fontFamily: "'IBM Plex Mono',monospace",
      borderBottom: `1px solid ${C.border}`,
    },
  };
}

export function themeCSS(C) {
  return `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700;800&family=DM+Serif+Display:ital@0;1&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: ${C.bg}; color: ${C.text}; font-family: 'IBM Plex Mono', 'Courier New', monospace; transition: background 0.2s, color 0.2s; }

    .tnav-link:hover      { color: ${C.accent} !important; }
    .tnav-toggle:hover    { border-color: ${C.accent} !important; }
    .tnav-hamburger:hover { color: ${C.accent} !important; border-color: ${C.accent} !important; }

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
