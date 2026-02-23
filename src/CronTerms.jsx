// src/CronTerms.jsx
import { useEffect } from "react";

const A = "#f0c040";

export default function CronTerms() {
  useEffect(() => window.scrollTo(0, 0), []);

  return (
    <div style={S.root}>
      <style>{css}</style>

      <nav style={S.nav}>
        <a href="/" style={S.navLogo}>CRON<span style={{ color: A }}>.EXPLAIN</span></a>
        <div style={S.navRight}>
          <a href="/" style={S.navLink} className="nav-link">← Home</a>
          <a href="/docs" style={S.navLink} className="nav-link">Docs</a>
          <a href="/scheduler" style={S.navLink} className="nav-link">Scheduler</a>
        </div>
      </nav>

      <main style={S.main}>
        <div style={S.doc}>

          <div style={S.docHeader}>
            <div style={S.badge}>LEGAL</div>
            <h1 style={S.h1}>Privacy Policy & Terms of Service</h1>
            <p style={S.meta}>Effective: February 23, 2026 · cronexplain.netlify.app · Operator: mykelayo</p>
          </div>

          <hr style={S.rule} />

          {/* ── PRIVACY ── */}
          <section>
            <h2 style={S.h2}>Privacy Policy</h2>

            <h3 style={S.h3}>1. What we collect</h3>
            <p style={S.p}>The cron explainer tool runs entirely in your browser, no data is sent to our servers when you use it. The API and Scheduler features involve the following data:</p>

            <div style={S.table}>
              {[
                ["Cron expressions (API)", "Processed server-side and immediately discarded. Not stored."],
                ["Email address (Scheduler)", "Stored to send alerts. Never sold or shared."],
                ["Job name & cron (Scheduler)", "Stored in Redis to power email alerts."],
                ["IP address", "Not logged by us. Standard server logs via Netlify."],
                ["Analytics", "Google Analytics may collect anonymous page view data if enabled."],
                ["Cookies", "Ad providers (if active) may set cookies. See section 3."],
              ].map(([d, det]) => (
                <div key={d} style={S.tableRow}>
                  <span style={S.tableCell}>{d}</span>
                  <span style={{ ...S.tableCell, flex: 2, color: "#666" }}>{det}</span>
                </div>
              ))}
            </div>

            <h3 style={S.h3}>2. Scheduler data</h3>
            <ul style={S.ul}>
              <li>Your email and job data are stored in Upstash Redis.</li>
              <li>Data is used solely to send you scheduled email alerts. Nothing else.</li>
              <li>You can delete your alerts at any time using your management token. Deletion removes all associated data immediately.</li>
              <li>We do not sell, share, or use your email for marketing.</li>
            </ul>

            <h3 style={S.h3}>3. Advertising and analytics</h3>
            <p style={S.p}>Cron.Explain may display advertising to support the free service.</p>
            <ul style={S.ul}>
              <li><strong>Cron expressions and job data are never used for ad targeting.</strong></li>
              <li>If Google AdSense is active, it may use cookies and your IP to serve contextual ads, governed by Google's own privacy policy.</li>
              <li>If Google Analytics is active, anonymous usage data (page views, sessions) is collected. No personally identifying information is sent.</li>
              <li>All features work identically whether or not you accept ad cookies.</li>
              <li>Opt out of personalized ads at <a href="https://adssettings.google.com" target="_blank" rel="noreferrer" style={S.link}>adssettings.google.com</a>.</li>
            </ul>

            <h3 style={S.h3}>4. Third-party services</h3>
            <div style={S.table}>
              {[
                ["Netlify", "Hosting & functions", "Standard server logs"],
                ["Upstash Redis", "Scheduler job storage", "Job data only"],
                ["Resend", "Email delivery", "Email address + alert content"],
                ["Google Analytics", "Usage metrics (optional)", "Anonymous page views"],
                ["Google AdSense", "Advertising (if enabled)", "Cookie, IP (Google policy)"],
              ].map(([s,p,d]) => (
                <div key={s} style={S.tableRow}>
                  <span style={S.tableCell}>{s}</span>
                  <span style={{ ...S.tableCell, color:"#666" }}>{p}</span>
                  <span style={{ ...S.tableCell, color:"#555" }}>{d}</span>
                </div>
              ))}
            </div>

            <h3 style={S.h3}>5. Data deletion</h3>
            <p style={S.p}>To delete all your Scheduler data: visit <a href="/scheduler" style={S.link}>/scheduler</a>, look up your email, and delete each job using your management token. Deletion is immediate and permanent.</p>

            <h3 style={S.h3}>6. Changes</h3>
            <p style={S.p}>Policy updates will be reflected on this page with a new effective date.</p>
          </section>

          <hr style={S.rule} />

          {/* ── TERMS ── */}
          <section>
            <h2 style={S.h2}>Terms of Service</h2>

            <h3 style={S.h3}>1. Acceptance</h3>
            <p style={S.p}>By using Cron.Explain ("the Service"), you agree to these Terms. If you do not agree, do not use the Service.</p>

            <h3 style={S.h3}>2. What the Service does</h3>
            <p style={S.p}>Cron.Explain provides a free cron expression decoder, a REST API for programmatic access, and a Scheduler feature for email-based cron job alerts.</p>

            <h3 style={S.h3}>3. Acceptable use</h3>
            <p style={S.p}>You may not use the Service to:</p>
            <ul style={S.ul}>
              <li>Spam, abuse, or overload the API beyond reasonable use</li>
              <li>Register fake or malicious email addresses in the Scheduler</li>
              <li>Attempt to access or modify other users' scheduled jobs</li>
              <li>Violate any applicable law or regulation</li>
            </ul>
            <p style={S.p}>We reserve the right to rate-limit or block access for abusive usage.</p>

            <h3 style={S.h3}>4. Advertising</h3>
            <ul style={S.ul}>
              <li>The Service may display advertising to support its free operation.</li>
              <li>Ad providers may use cookies, governed by their own privacy policies.</li>
              <li><strong>Your cron data is never shared with advertisers.</strong></li>
              <li>You may opt out of personalized advertising via your browser or provider settings.</li>
            </ul>

            <h3 style={S.h3}>5. Scheduler service level</h3>
            <div style={S.warningBox}>
              The Scheduler is a best-effort service. Email alerts may be delayed or missed due to infrastructure outages. <strong>Do not rely on this service as your sole mechanism for time-critical job monitoring.</strong> For production systems, use dedicated monitoring tools.
            </div>

            <h3 style={S.h3}>6. No warranty</h3>
            <p style={S.p}>The Service is provided "as is" without warranty of any kind. We do not warrant that the Service will be available at all times, that the cron parser is free from errors, or that all scheduled emails will be delivered.</p>

            <h3 style={S.h3}>7. Limitation of liability</h3>
            <p style={S.p}>The operator shall not be liable for missed cron alerts, incorrect explanations, data loss, or any indirect or consequential damages arising from use of the Service.</p>

            <h3 style={S.h3}>8. Open source</h3>
            <p style={S.p}>The source code is MIT licensed at <a href="https://github.com/mykelayo/cron-explain" target="_blank" rel="noreferrer" style={S.link}>github.com/mykelayo/cron-explain</a>.</p>

            <h3 style={S.h3}>9. Contact</h3>
            <p style={S.p}>Questions or data deletion requests: <a href="https://github.com/mykelayo/cron-explain" target="_blank" rel="noreferrer" style={S.link}>open a GitHub issue</a>.</p>
          </section>

          <hr style={S.rule} />
          <p style={S.meta}>Cron.Explain is an open-source project operated by an individual developer, not a registered company.</p>

        </div>
      </main>

      <footer style={S.footer}>
        <span style={{ color:"#fff", fontWeight:700 }}>CRON<span style={{ color: A }}>.EXPLAIN</span></span>
        <div style={{ display:"flex", gap:"16px" }}>
          <a href="/" style={S.footerLink} className="nav-link">Home</a>
          <a href="/docs" style={S.footerLink} className="nav-link">Docs</a>
          <a href="/scheduler" style={S.footerLink} className="nav-link">Scheduler</a>
        </div>
      </footer>
    </div>
  );
}

const S = {
  root: { background:"#0a0a0a", minHeight:"100vh", fontFamily:"'IBM Plex Mono','Courier New',monospace", color:"#e0e0e0" },
  nav: { position:"sticky", top:0, zIndex:100, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0 32px", height:"61px", background:"rgba(10,10,10,0.97)", borderBottom:"1px solid #141414", backdropFilter:"blur(8px)" },
  navLogo: { fontSize:"16px", fontWeight:"800", color:"#fff", textDecoration:"none" },
  navRight: { display:"flex", gap:"20px", alignItems:"center" },
  navLink: { color:"#555", textDecoration:"none", fontSize:"12px", letterSpacing:"1px", transition:"color 0.2s" },
  main: { display:"flex", justifyContent:"center", padding:"48px 20px 80px" },
  doc: { width:"100%", maxWidth:"680px", display:"flex", flexDirection:"column", gap:"24px" },
  docHeader: { display:"flex", flexDirection:"column", gap:"12px" },
  badge: { alignSelf:"flex-start", background:"#1a1500", border:`1px solid ${A}33`, borderRadius:"2px", padding:"4px 12px", fontSize:"9px", letterSpacing:"3px", color: A },
  h1: { fontSize:"clamp(26px,5vw,40px)", fontWeight:"800", color:"#fff", margin:0, letterSpacing:"-1.5px", fontFamily:"'DM Serif Display','Georgia',serif" },
  h2: { fontSize:"20px", fontWeight:"700", color:"#fff", margin:"0 0 20px 0" },
  h3: { fontSize:"10px", fontWeight:"600", letterSpacing:"2px", color: A, margin:"28px 0 10px 0", textTransform:"uppercase" },
  meta: { fontSize:"11px", color:"#333", letterSpacing:"1px", margin:0 },
  p: { fontSize:"14px", color:"#666", lineHeight:"1.85", margin:"0 0 12px 0" },
  ul: { fontSize:"14px", color:"#666", lineHeight:"1.85", paddingLeft:"18px", margin:"0 0 12px 0", display:"flex", flexDirection:"column", gap:"6px" },
  rule: { border:"none", borderTop:"1px solid #141414", margin:"8px 0" },
  link: { color: A, textDecoration:"underline", textUnderlineOffset:"3px" },
  table: { border:"1px solid #141414", borderRadius:"4px", overflow:"hidden", marginBottom:"16px" },
  tableRow: { display:"flex", borderBottom:"1px solid #141414", flexWrap:"wrap" },
  tableCell: { flex:1, padding:"10px 14px", fontSize:"12px", color:"#aaa", minWidth:"140px", lineHeight:"1.6" },
  warningBox: { background:"#0f0900", border:"1px solid #2a1a00", borderLeft:`3px solid ${A}`, borderRadius:"4px", padding:"16px 18px", fontSize:"13px", color:"#888", lineHeight:"1.8", marginBottom:"12px" },
  footer: { borderTop:"1px solid #141414", padding:"20px 32px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px" },
  footerLink: { color:"#444", textDecoration:"none", fontSize:"12px", transition:"color 0.2s" },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700;800&family=DM+Serif+Display:ital@0;1&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: #0a0a0a; }
  .nav-link:hover { color: ${A} !important; }
  ul li::marker { color: ${A}; }
  @media (max-width: 500px) {
    main { padding: 24px 16px 60px !important; }
    nav { padding: 0 16px !important; }
  }
`;
