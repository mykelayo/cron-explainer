// src/CronTerms.jsx
import { useEffect } from "react";
import { useTheme } from "./theme.js";
import ThemeNav, { themeCSS } from "./ThemeNav.jsx";
import { SITE_URL, GITHUB_URL } from "./config.js";

export default function CronTerms() {
  const { C } = useTheme();
  useEffect(() => window.scrollTo(0, 0), []);

  const styles = makeStyles(C);

  return (
    <div style={styles.root}>
      <style>{themeCSS(C)}{termsExtras(C)}</style>

      <ThemeNav links={[
        { href:"/",          label:"← Home"   },
        { href:"/docs",      label:"Docs"      },
        { href:"/scheduler", label:"Scheduler" },
      ]} />

      <main style={styles.main}>
        <div style={styles.doc}>

          {/* Header */}
          <div style={styles.docHeader}>
            <div style={styles.badge}>LEGAL</div>
            <h1 style={styles.h1}>Privacy Policy &amp; Terms of Service</h1>
            <p style={styles.meta}>Effective: February 23, 2026 · {SITE_URL.replace("https://","")} · Operator: mykelayo</p>
          </div>

          <hr style={styles.rule} />

          {/* ── PRIVACY ── */}
          <section>
            <h2 style={styles.h2}>Privacy Policy</h2>

            <h3 style={styles.h3}>1. What we collect</h3>
            <p style={styles.p}>The cron explainer runs entirely in your browser, no data is sent when you use the decoder. The API and Scheduler involve the following:</p>

            <div style={styles.table}>
              {[
                ["Cron expressions (API)", "Processed and immediately discarded. Not stored."],
                ["Email (Scheduler)",      "Stored to deliver alerts. Never sold or shared."],
                ["Job name & cron",        "Stored on our server to power email alerts."],
                ["IP address",             "Not logged by us. Standard Netlify server logs apply."],
                ["Analytics",              "Anonymous page view data via Google Analytics if enabled."],
                ["Ad cookies",             "Ad providers (if active) may set cookies per their policy."],
              ].map(([dataType, detail]) => (
                <div key={dataType} style={styles.tableRow}>
                  <span style={{ ...styles.tableCell, fontWeight:"500", minWidth:"160px" }}>{dataType}</span>
                  <span style={{ ...styles.tableCell, flex:2, color:C.textSub }}>{detail}</span>
                </div>
              ))}
            </div>

            <h3 style={styles.h3}>2. Scheduler data</h3>
            <ul style={styles.ul}>
              <li>Your email and job data are stored on Netlify infrastructure.</li>
              <li>Data is used solely to send scheduled email alerts — nothing else.</li>
              <li>You can delete any alert at any time using your management token. Deletion is instant and permanent.</li>
              <li>We do not sell, share, or use your email for any marketing.</li>
            </ul>

            <h3 style={styles.h3}>3. Advertising &amp; analytics</h3>
            <p style={styles.p}>Cron.Explain may display advertising to support the free service.</p>
            <ul style={styles.ul}>
              <li><strong>Cron expressions and job data are never used for ad targeting.</strong></li>
              <li>If Google AdSense is active, it may use cookies and your IP per Google's privacy policy.</li>
              <li>Google Analytics may collect anonymous page-view data (no personally identifying info).</li>
              <li>Opt out of personalised ads at <a href="https://adssettings.google.com" target="_blank" rel="noreferrer" style={styles.link}>adssettings.google.com</a>.</li>
              <li>All site features work identically regardless of cookie preference.</li>
            </ul>

            <h3 style={styles.h3}>4. Third-party services</h3>
            {/* FIX: destructuring renamed from ([s,p,d]) to ([svc,purpose,data]) to avoid
                shadowing the outer `styles` variable (previously `s`). */}
            <div style={styles.table}>
              {[
                ["Netlify",          "Hosting & functions",      "Standard server logs"          ],
                ["Netlify Blobs",    "Scheduler job storage",    "Job data only"                 ],
                ["Gmail / Resend",   "Email delivery",           "Email address + alert content" ],
                ["Google Analytics", "Usage metrics (optional)", "Anonymous page views"          ],
                ["Google AdSense",   "Advertising (if enabled)", "Cookie, IP — Google policy"   ],
              ].map(([svc, purpose, data]) => (
                <div key={svc} style={threeColRow(C)}>
                  <span style={{ ...threeColCell(C), fontWeight:"500" }}>{svc}</span>
                  <span style={{ ...threeColCell(C), color:C.textSub }}>{purpose}</span>
                  <span style={{ ...threeColCell(C), color:C.textMuted }}>{data}</span>
                </div>
              ))}
            </div>

            <h3 style={styles.h3}>5. Data deletion</h3>
            <p style={styles.p}>Visit <a href="/scheduler" style={styles.link}>/scheduler</a>, look up your email, and delete each job with your management token. All data is removed immediately.</p>

            <h3 style={styles.h3}>6. Policy changes</h3>
            <p style={styles.p}>Updates are reflected here with a new effective date at the top.</p>
          </section>

          <hr style={styles.rule} />

          {/* ── TERMS ── */}
          <section>
            <h2 style={styles.h2}>Terms of Service</h2>

            <h3 style={styles.h3}>1. Acceptance</h3>
            <p style={styles.p}>By using Cron.Explain you agree to these Terms. If you disagree, do not use the Service.</p>

            <h3 style={styles.h3}>2. Acceptable use</h3>
            <p style={styles.p}>You may not:</p>
            <ul style={styles.ul}>
              <li>Abuse or overload the API beyond reasonable use</li>
              <li>Register fake or disposable emails to circumvent limits</li>
              <li>Attempt to access or tamper with other users' jobs</li>
              <li>Violate any applicable law or regulation</li>
            </ul>

            <h3 style={styles.h3}>3. Advertising</h3>
            <ul style={styles.ul}>
              <li>The Service may display advertising to fund free operation.</li>
              <li>Ad providers may use cookies, governed by their own policies.</li>
              <li><strong>Your cron data is never shared with advertisers.</strong></li>
              <li>You may opt out of personalised ads in your browser settings.</li>
            </ul>

            <h3 style={styles.h3}>4. Scheduler service level</h3>
            <div style={styles.warnBox}>
              <strong>⚠ Best-effort service.</strong> Email alerts may be delayed or missed due to infrastructure outages. Do not rely on this as your sole mechanism for production monitoring. Use dedicated APM tools for critical systems.
            </div>

            <h3 style={styles.h3}>5. No warranty</h3>
            <p style={styles.p}>The Service is provided "as is" without warranty of any kind — no guarantee of availability, accuracy of the cron parser, or email delivery.</p>

            <h3 style={styles.h3}>6. Limitation of liability</h3>
            <p style={styles.p}>The operator is not liable for missed alerts, data loss, or any indirect damages arising from use of the Service.</p>

            <h3 style={styles.h3}>7. Open source</h3>
            <p style={styles.p}>Source code is MIT licensed at <a href={GITHUB_URL} target="_blank" rel="noreferrer" style={styles.link}>{GITHUB_URL.replace("https://","")}</a>.</p>

            <h3 style={styles.h3}>8. Contact</h3>
            <p style={styles.p}>Questions or data deletion requests: <a href={GITHUB_URL/issue} target="_blank" rel="noreferrer" style={styles.link}>open a GitHub issue</a>.</p>
          </section>

          <hr style={styles.rule} />
          <p style={styles.meta}>Cron.Explain is an open-source project run by an individual developer, not a registered company.</p>

        </div>
      </main>

      <footer style={styles.footer}>
        <span style={{ fontWeight:700, color:C.text }}>CRON<span style={{ color:C.accent }}>.EXPLAIN</span></span>
        <div style={{ display:"flex", gap:"16px", flexWrap:"wrap" }}>
          {[["Home","/"],["Docs","/docs"],["Scheduler","/scheduler"]].map(([label,href])=>(
            <a key={href} href={href} style={{ color:C.textSub, textDecoration:"none", fontSize:"12px" }} className="tnav-link">{label}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}

// ── Helpers for the 3-column table (named clearly, not anonymous) ──────────────

function threeColRow(C) {
  return { display:"flex", borderBottom:`1px solid ${C.border}`, flexWrap:"wrap" };
}
function threeColCell(C) {
  return { flex:1, padding:"10px 14px", fontSize:"12px", color:C.text, lineHeight:"1.6", minWidth:"110px" };
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(C) {
  return {
    root:      { background:C.bg, minHeight:"100vh", color:C.text, fontFamily:"'IBM Plex Mono',monospace", transition:"background 0.2s, color 0.2s" },
    main:      { display:"flex", justifyContent:"center", padding:"clamp(28px,5vw,52px) clamp(16px,4vw,24px) 80px" },
    doc:       { width:"100%", maxWidth:"680px", display:"flex", flexDirection:"column", gap:"22px" },
    docHeader: { display:"flex", flexDirection:"column", gap:"10px" },
    badge:     { alignSelf:"flex-start", background:C.accentDim, border:`1px solid ${C.accent}33`, borderRadius:"2px", padding:"4px 12px", fontSize:"9px", letterSpacing:"3px", color:C.accent },
    h1:        { fontSize:"clamp(24px,5vw,38px)", fontWeight:"800", color:C.text, margin:0, letterSpacing:"-1.5px", fontFamily:"'DM Serif Display',Georgia,serif" },
    h2:        { fontSize:"20px", fontWeight:"700", color:C.text, margin:"0 0 18px" },
    h3:        { fontSize:"9px", fontWeight:"600", letterSpacing:"2.5px", color:C.accent, margin:"26px 0 10px", textTransform:"uppercase" },
    meta:      { fontSize:"11px", color:C.textMuted, letterSpacing:"0.5px", margin:0 },
    p:         { fontSize:"14px", color:C.textSub, lineHeight:"1.85", margin:"0 0 10px" },
    ul:        { fontSize:"14px", color:C.textSub, lineHeight:"1.85", paddingLeft:"18px", margin:"0 0 10px", display:"flex", flexDirection:"column", gap:"5px" },
    link:      { color:C.accent, textDecoration:"underline", textUnderlineOffset:"3px" },
    rule:      { border:"none", borderTop:`1px solid ${C.border}`, margin:"6px 0" },
    table:     { border:`1px solid ${C.border}`, borderRadius:"4px", overflow:"hidden", marginBottom:"14px" },
    tableRow:  { display:"flex", borderBottom:`1px solid ${C.border}`, flexWrap:"wrap" },
    tableCell: { flex:1, padding:"10px 14px", fontSize:"12px", color:C.text, lineHeight:"1.6", minWidth:"130px" },
    warnBox:   { background:C.accentDim, border:`1px solid ${C.accent}44`, borderLeft:`3px solid ${C.accent}`, borderRadius:"4px", padding:"14px 16px", fontSize:"13px", color:C.textSub, lineHeight:"1.8", marginBottom:"10px" },
    footer:    { borderTop:`1px solid ${C.border}`, padding:"20px clamp(16px,4vw,32px)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px", fontFamily:"'IBM Plex Mono',monospace" },
  };
}

function termsExtras(C) {
  return `
    ul li::marker { color: ${C.accent}; }
    @media (max-width: 500px) {
      main { padding: 20px 14px 60px !important; }
    }
  `;
}
