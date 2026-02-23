import { useState } from "react";

// ─── ONE PLACE TO CHANGE THE DOMAIN ──────────────────────────────────────────
const BASE_URL = "https://cronexplain.netlify.app";

const EXAMPLES = [
  { label: "Weekday mornings",   expr: "0 9 * * 1-5" },
  { label: "Every 15 minutes",   expr: "*/15 * * * *" },
  { label: "Monthly reset",      expr: "0 0 1 * *" },
  { label: "Every 6 hours",      expr: "0 */6 * * *" },
  { label: "Friday evenings",    expr: "30 18 * * 5" },
  { label: "Every minute",       expr: "* * * * *" },
];

const CODE_SAMPLES = {
  curl: (expr) =>
`curl -X POST ${BASE_URL}/api/explain \\
  -H "Content-Type: application/json" \\
  -d '{"cron": "${expr}"}'`,

  js: (expr) =>
`const res = await fetch("${BASE_URL}/api/explain", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ cron: "${expr}" }),
});
const data = await res.json();
console.log(data.explanation);`,

  python: (expr) =>
`import requests

res = requests.post(
    "${BASE_URL}/api/explain",
    json={"cron": "${expr}"}
)
print(res.json()["explanation"])`,

  node: (expr) =>
`const https = require("https");

const body = JSON.stringify({ cron: "${expr}" });
const options = {
  hostname: "${BASE_URL.replace("https://", "")}",
  path: "/api/explain",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  },
};

const req = https.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => data += chunk);
  res.on("end", () => console.log(JSON.parse(data).explanation));
});
req.write(body);
req.end();`,
};

// ─── INLINE TESTER ───────────────────────────────────────────────────────────

function InlineTester() {
  const [expr, setExpr] = useState("0 9 * * 1-5");
  const [lang, setLang] = useState("curl");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function tryIt() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE_URL}/api/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cron: expr }),
      });
      const data = await res.json();
      setResult({ ok: res.ok, data });
    } catch (e) {
      setResult({ ok: false, data: { error: e.message } });
    } finally {
      setLoading(false);
    }
  }

  const code = CODE_SAMPLES[lang]?.(expr) ?? "";

  return (
    <div style={S.playCard}>
      <div style={S.playRow}>
        <div style={S.playExprWrap}>
          <span style={S.playLabel}>EXPRESSION</span>
          <div style={S.playExprRow}>
            <span style={S.playPrompt}>$</span>
            <input
              value={expr}
              onChange={e => setExpr(e.target.value)}
              style={S.playInput}
              spellCheck={false}
              className="play-input"
            />
          </div>
        </div>
        <button style={S.playBtn} onClick={tryIt} disabled={loading} className="play-run-btn">
          {loading ? "..." : "Run ▶"}
        </button>
      </div>

      <div style={S.playUrl}>{BASE_URL}/api/explain</div>

      {result && (
        <div style={{ ...S.playResult, borderLeftColor: result.ok ? "#4caf50" : "#cc3333" }}>
          <div style={S.playResultLabel}>{result.ok ? "200 OK" : "ERROR"}</div>
          <pre style={S.playResultPre}>{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}

      <div style={S.langTabs}>
        {Object.keys(CODE_SAMPLES).map(l => (
          <button key={l} style={{...S.langTab, ...(lang===l ? S.langTabOn : {})}}
            onClick={() => setLang(l)} className="lang-tab">
            {l}
          </button>
        ))}
      </div>
      <div style={S.codeBlock}>
        <pre style={S.pre}>{code}</pre>
        <button
          style={{...S.codeopyBtn, ...(copied ? S.codeCopiedBtn : {})}}
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="copy-code-btn"
        >
          {copied ? "✓" : "COPY"}
        </button>
      </div>
    </div>
  );
}

// ─── NAV SECTIONS ────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: "overview",    label: "Overview" },
  { id: "endpoint",   label: "Endpoint", method: "POST" },
  { id: "request",    label: "Request" },
  { id: "response",   label: "Response" },
  { id: "errors",     label: "Errors" },
  { id: "examples",   label: "Examples" },
  { id: "playground", label: "Playground" },
];

// ─── DOCS PAGE ────────────────────────────────────────────────────────────────

export default function Docs() {
  const [active, setActive] = useState("overview");
  const [lang, setLang] = useState("curl");
  const [sideOpen, setSideOpen] = useState(false);

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setActive(id);
    setSideOpen(false);
  }

  return (
    <div style={S.root}>
      <style>{docsCss}</style>

      {/* ── NAV ── */}
      <nav style={S.nav}>
        <a href="/" style={S.navLogo}>
          CRON<span style={S.navAccent}>.EXPLAIN</span>
        </a>
        <div style={S.navRight}>
          <a href="/" style={S.navLink} className="nav-link">Home</a>
          <a href="/scheduler" style={S.navLink} className="nav-link">Scheduler</a>
          <a href="/terms" style={S.navLink} className="nav-link">Terms</a>
          {/* Mobile hamburger */}
          <button style={S.hamburger} onClick={() => setSideOpen(o => !o)} className="hamburger" aria-label="Menu">
            {sideOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* ── MOBILE SIDEBAR DRAWER ── */}
      {sideOpen && (
        <div style={S.mobileDrawer} className="mobile-drawer">
          {NAV_SECTIONS.map(sec => (
            <button key={sec.id} style={{...S.mobileDrawerLink, ...(active===sec.id ? S.mobileDrawerLinkOn : {})}}
              onClick={() => scrollTo(sec.id)}>
              {sec.method && <span style={S.methodTag}>{sec.method}</span>}
              {sec.label}
            </button>
          ))}
        </div>
      )}

      {/* ── LAYOUT ── */}
      <div style={S.layout}>

        {/* Sidebar — hidden on mobile */}
        <aside style={S.sidebar} className="docs-sidebar">
          <div style={S.sideLabel}>API REFERENCE</div>
          {NAV_SECTIONS.map(sec => (
            <button key={sec.id}
              style={{...S.sideLink, ...(active===sec.id ? S.sideLinkOn : {})}}
              onClick={() => scrollTo(sec.id)}
              className="side-link"
            >
              {sec.method && <span style={S.methodTag}>{sec.method}</span>}
              {sec.label}
            </button>
          ))}
          <div style={{ marginTop: "32px", borderTop: "1px solid #1a1a1a", paddingTop: "20px" }}>
            <div style={S.sideLabel}>LINKS</div>
            <a href="/" style={{...S.sideLink, textDecoration:"none", display:"flex"}} className="side-link">← Home</a>
            <a href="/scheduler" style={{...S.sideLink, textDecoration:"none", display:"flex"}} className="side-link">⏰ Scheduler</a>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main style={S.main}>

          {/* Overview */}
          <section id="overview" style={S.section}>
            <div style={S.pageLabel}>API REFERENCE</div>
            <h1 style={S.pageTitle}>Cron.Explain API</h1>
            <p style={S.lead}>
              A simple REST API that takes a cron expression and returns a plain-English explanation,
              a structured field breakdown, and the next scheduled run times. Free to use. No API key required.
            </p>
            <div style={S.infoGrid}>
              {[
                { label:"BASE URL",      val: BASE_URL },
                { label:"AUTH",          val: "None required" },
                { label:"RATE LIMIT",    val: "60 req / min" },
                { label:"FORMAT",        val: "JSON" },
              ].map(item => (
                <div key={item.label} style={S.infoCell}>
                  <div style={S.infoLabel}>{item.label}</div>
                  <div style={S.infoVal}>{item.val}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Endpoint */}
          <section id="endpoint" style={S.section}>
            <h2 style={S.h2}>Endpoint</h2>
            <div style={S.endpointRow}>
              <span style={S.endpointMethod}>POST</span>
              <span style={S.endpointPath}>/api/explain</span>
            </div>
            <p style={S.body}>
              Accepts a JSON body with a <code style={S.inlineCode}>cron</code> field containing a standard
              5-field cron expression. Returns the full explanation synchronously.
            </p>
          </section>

          {/* Request */}
          <section id="request" style={S.section}>
            <h2 style={S.h2}>Request</h2>
            <p style={S.body}>Send a <code style={S.inlineCode}>POST</code> request with <code style={S.inlineCode}>Content-Type: application/json</code>.</p>
            <div style={S.paramTable}>
              <div style={S.paramHeader}>
                <span>Field</span><span>Type</span><span>Required</span><span>Description</span>
              </div>
              <div style={S.paramRow}>
                <code style={S.inlineCode}>cron</code>
                <span style={S.paramType}>string</span>
                <span style={S.paramReq}>yes</span>
                <span style={S.paramDesc}>A standard 5-field cron expression (e.g. <code style={S.inlineCode}>0 9 * * 1-5</code>)</span>
              </div>
            </div>
            <div style={S.codeBlock}>
              <pre style={S.pre}>{`{
  "cron": "0 9 * * 1-5"
}`}</pre>
            </div>
          </section>

          {/* Response */}
          <section id="response" style={S.section}>
            <h2 style={S.h2}>Response</h2>
            <p style={S.body}>Returns a JSON object with three top-level fields.</p>
            <div style={S.codeBlock}>
              <pre style={S.pre}>{`{
  "cron": "0 9 * * 1-5",
  "explanation": "At 9:00 AM, on Monday through Friday",
  "fields": {
    "minute":      { "value": "0",     "meaning": "at minute 0" },
    "hour":        { "value": "9",     "meaning": "at 9" },
    "dayOfMonth":  { "value": "*",     "meaning": "every day" },
    "month":       { "value": "*",     "meaning": "every month" },
    "dayOfWeek":   { "value": "1-5",   "meaning": "Monday through Friday" }
  },
  "nextRuns": [
    "2026-02-24T09:00:00.000Z",
    "2026-02-25T09:00:00.000Z",
    "2026-02-26T09:00:00.000Z",
    "2026-02-27T09:00:00.000Z",
    "2026-02-28T09:00:00.000Z"
  ]
}`}</pre>
            </div>
            <div style={S.paramTable}>
              <div style={S.paramHeader}><span>Field</span><span>Type</span><span>Description</span></div>
              {[
                ["explanation", "string",   "Human-readable English sentence"],
                ["fields",      "object",   "Per-field breakdown with value and meaning"],
                ["nextRuns",    "string[]", "Next 5 ISO 8601 run timestamps (UTC)"],
                ["cron",        "string",   "The original expression echoed back"],
              ].map(([f,t,d]) => (
                <div key={f} style={S.paramRow}>
                  <code style={S.inlineCode}>{f}</code>
                  <span style={S.paramType}>{t}</span>
                  <span style={S.paramDesc}>{d}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Errors */}
          <section id="errors" style={S.section}>
            <h2 style={S.h2}>Errors</h2>
            <p style={S.body}>All errors return a JSON object with an <code style={S.inlineCode}>error</code> field.</p>
            <div style={S.paramTable}>
              <div style={S.paramHeader}><span>Status</span><span>Meaning</span></div>
              {[
                ["400", "Missing or invalid cron expression"],
                ["405", "Wrong HTTP method (use POST)"],
                ["429", "Rate limit exceeded (60 req/min)"],
                ["500", "Internal server error"],
              ].map(([s,m]) => (
                <div key={s} style={S.paramRow}>
                  <span style={S.paramType}>{s}</span>
                  <span style={S.paramDesc}>{m}</span>
                </div>
              ))}
            </div>
            <div style={S.codeBlock}>
              <pre style={S.pre}>{`{ "error": "Invalid cron expression. Expected 5 fields." }`}</pre>
            </div>
          </section>

          {/* Examples */}
          <section id="examples" style={S.section}>
            <h2 style={S.h2}>Code examples</h2>
            <div style={S.langTabs}>
              {Object.keys(CODE_SAMPLES).map(l => (
                <button key={l} style={{...S.langTab, ...(lang===l ? S.langTabOn : {})}}
                  onClick={() => setLang(l)} className="lang-tab">
                  {l}
                </button>
              ))}
            </div>
            <div style={S.examplePicker}>
              {EXAMPLES.map((ex,i) => (
                <div key={i} style={S.exampleExpr}
                  onClick={() => setLang(lang)}>
                  <span style={S.exCode}>{ex.expr}</span>
                  <span style={S.exLabel}>{ex.label}</span>
                </div>
              ))}
            </div>
            <div style={S.codeBlock}>
              <pre style={S.pre}>{CODE_SAMPLES[lang]?.(EXAMPLES[0].expr)}</pre>
            </div>
            <div style={S.alertBox}>
              <span>ℹ</span>
              <span>Replace <code style={{...S.inlineCode, color:"#7ab"}}>EXPRESSION</code> with your actual cron string. The API is free and does not require authentication.</span>
            </div>
          </section>

          {/* Playground */}
          <section id="playground" style={S.section}>
            <h2 style={S.h2}>Live playground</h2>
            <p style={S.body}>Test the API directly from this page. Your request hits the real endpoint.</p>
            <InlineTester />
          </section>

        </main>
      </div>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const S = {
  root: { background:"#0a0a0a", minHeight:"100vh", fontFamily:"'IBM Plex Mono','Courier New',monospace", color:"#e0e0e0" },
  nav: { position:"sticky", top:0, zIndex:100, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0 32px", height:"61px", background:"rgba(10,10,10,0.97)", borderBottom:"1px solid #141414", backdropFilter:"blur(8px)" },
  navLogo: { fontSize:"16px", fontWeight:"800", color:"#fff", textDecoration:"none", letterSpacing:"-0.5px" },
  navAccent: { color:"#f0c040" },
  navRight: { display:"flex", alignItems:"center", gap:"20px" },
  navLink: { color:"#555", textDecoration:"none", fontSize:"12px", letterSpacing:"1px", transition:"color 0.2s" },
  hamburger: { display:"none", background:"transparent", border:"1px solid #2a2a2a", color:"#aaa", fontSize:"16px", padding:"4px 10px", cursor:"pointer", borderRadius:"3px", fontFamily:"inherit" },

  mobileDrawer: { position:"fixed", top:"61px", left:0, right:0, background:"#0d0d0d", borderBottom:"1px solid #1a1a1a", zIndex:99, padding:"16px 20px", display:"flex", flexDirection:"column", gap:"4px" },
  mobileDrawerLink: { background:"transparent", border:"none", color:"#666", fontSize:"13px", padding:"10px 12px", cursor:"pointer", textAlign:"left", fontFamily:"inherit", letterSpacing:"0.5px", borderRadius:"3px", display:"flex", gap:"8px", alignItems:"center" },
  mobileDrawerLinkOn: { color:"#f0c040", background:"#1a1a1a" },

  layout: { display:"flex", maxWidth:"1200px", margin:"0 auto", minHeight:"calc(100vh - 61px)" },
  sidebar: { width:"210px", flexShrink:0, padding:"36px 0 36px 28px", borderRight:"1px solid #141414", position:"sticky", top:"61px", height:"calc(100vh - 61px)", overflowY:"auto" },
  sideLabel: { fontSize:"9px", letterSpacing:"3px", color:"#333", marginBottom:"12px" },
  sideLink: { background:"none", border:"none", display:"flex", alignItems:"center", gap:"8px", padding:"6px 4px", color:"#555", cursor:"pointer", fontSize:"12px", letterSpacing:"0.5px", transition:"color 0.15s", width:"100%", textAlign:"left", fontFamily:"inherit" },
  sideLinkOn: { color:"#f0c040" },
  methodTag: { background:"#1a2a1a", color:"#4caf50", fontSize:"9px", padding:"2px 6px", borderRadius:"2px", letterSpacing:"1px" },

  main: { flex:1, padding:"40px 32px 80px", minWidth:0 },  // minWidth:0 is critical for flex overflow
  section: { maxWidth:"720px", marginBottom:"64px", paddingTop:"8px" },

  pageLabel: { fontSize:"10px", letterSpacing:"4px", color:"#444", marginBottom:"16px" },
  pageTitle: { fontSize:"clamp(28px,5vw,48px)", fontWeight:"800", color:"#fff", margin:"0 0 20px 0", letterSpacing:"-1.5px", fontFamily:"'DM Serif Display','Georgia',serif" },
  lead: { fontSize:"15px", color:"#666", lineHeight:"1.8", margin:"0 0 32px 0" },

  infoGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px,1fr))", gap:"1px", border:"1px solid #181818", borderRadius:"4px", overflow:"hidden" },
  infoCell: { background:"#0d0d0d", padding:"16px 18px" },
  infoLabel: { fontSize:"10px", letterSpacing:"2px", color:"#444", marginBottom:"6px" },
  infoVal: { fontSize:"12px", color:"#ccc", wordBreak:"break-all" },

  h2: { fontSize:"20px", fontWeight:"700", color:"#fff", margin:"0 0 16px 0", letterSpacing:"-0.5px" },
  body: { fontSize:"14px", color:"#666", lineHeight:"1.8", margin:"0 0 20px 0" },

  endpointRow: { display:"flex", alignItems:"center", gap:"12px", background:"#0d0d0d", border:"1px solid #1a1a1a", borderRadius:"4px", padding:"14px 18px", marginBottom:"16px", flexWrap:"wrap" },
  endpointMethod: { background:"#1a2a1a", color:"#4caf50", fontSize:"12px", fontWeight:"700", padding:"4px 10px", borderRadius:"3px", letterSpacing:"1px", flexShrink:0 },
  endpointPath: { fontSize:"15px", color:"#fff", letterSpacing:"1px", wordBreak:"break-all" },

  codeBlock: { background:"#0d0d0d", border:"1px solid #1a1a1a", borderRadius:"4px", padding:"20px 24px", margin:"16px 0", position:"relative", overflow:"hidden" },
  pre: { margin:0, fontSize:"12px", lineHeight:"1.7", color:"#ccc", overflowX:"auto", whiteSpace:"pre", wordBreak:"normal" },

  paramTable: { border:"1px solid #181818", borderRadius:"4px", overflow:"hidden", marginBottom:"16px" },
  paramHeader: { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(80px,1fr))", background:"#0a0a0a", padding:"10px 16px", fontSize:"10px", letterSpacing:"2px", color:"#333", gap:"12px" },
  paramRow: { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(80px,1fr))", padding:"12px 16px", borderTop:"1px solid #141414", fontSize:"12px", gap:"12px", alignItems:"start" },
  paramType: { color:"#5588aa", fontSize:"11px" },
  paramReq: { color:"#f0c040", fontSize:"11px" },
  paramDesc: { color:"#666", lineHeight:"1.6" },

  inlineCode: { background:"#161616", border:"1px solid #1e1e1e", borderRadius:"3px", padding:"1px 6px", fontSize:"12px", color:"#f0c040", fontFamily:"inherit" },

  langTabs: { display:"flex", gap:"4px", marginBottom:"12px", flexWrap:"wrap" },
  langTab: { background:"transparent", border:"1px solid #1a1a1a", color:"#444", fontFamily:"inherit", fontSize:"11px", letterSpacing:"1px", padding:"6px 14px", cursor:"pointer", borderRadius:"3px", transition:"all 0.15s" },
  langTabOn: { borderColor:"#f0c040", color:"#f0c040", background:"#111" },

  examplePicker: { display:"flex", flexWrap:"wrap", gap:"6px", marginBottom:"16px" },
  exampleExpr: { background:"#0d0d0d", border:"1px solid #1a1a1a", borderRadius:"3px", padding:"8px 12px", cursor:"pointer", display:"flex", flexDirection:"column", gap:"3px" },
  exCode: { color:"#f0c040", fontSize:"11px", letterSpacing:"0.5px" },
  exLabel: { color:"#444", fontSize:"10px" },

  alertBox: { background:"#0a0f1a", border:"1px solid #1a2a3a", borderLeft:"3px solid #3a6a9a", borderRadius:"4px", padding:"14px 18px", fontSize:"13px", color:"#557799", display:"flex", gap:"12px", alignItems:"flex-start" },

  // Playground
  playCard: { background:"#0d0d0d", border:"1px solid #1a1a1a", borderRadius:"6px", overflow:"hidden" },
  playRow: { display:"flex", gap:"12px", padding:"20px", borderBottom:"1px solid #141414", flexWrap:"wrap", alignItems:"flex-end" },
  playExprWrap: { flex:1, minWidth:"200px" },
  playLabel: { fontSize:"9px", letterSpacing:"3px", color:"#333", marginBottom:"8px", display:"block" },
  playExprRow: { display:"flex", alignItems:"center", gap:"10px", background:"#141414", border:"1px solid #1e1e1e", borderRadius:"4px", padding:"10px 14px" },
  playPrompt: { color:"#f0c040", fontSize:"16px", fontWeight:"bold" },
  playInput: { background:"transparent", border:"none", outline:"none", color:"#fff", fontSize:"16px", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"4px", width:"100%", caretColor:"#f0c040" },
  playBtn: { background:"#f0c040", color:"#000", border:"none", padding:"10px 20px", fontSize:"12px", letterSpacing:"1px", fontFamily:"'IBM Plex Mono',monospace", fontWeight:"700", cursor:"pointer", borderRadius:"3px", flexShrink:0, transition:"all 0.2s" },
  playUrl: { padding:"10px 20px", fontSize:"11px", color:"#333", letterSpacing:"0.5px", borderBottom:"1px solid #141414", wordBreak:"break-all" },
  playResult: { margin:"16px 20px", background:"#060606", border:"1px solid #1a1a1a", borderLeft:"3px solid #4caf50", borderRadius:"3px", padding:"14px 16px" },
  playResultLabel: { fontSize:"10px", letterSpacing:"2px", color:"#4caf50", marginBottom:"8px" },
  playResultPre: { margin:0, fontSize:"12px", color:"#aaa", lineHeight:"1.6", overflowX:"auto", whiteSpace:"pre", wordBreak:"normal" },
  codeopyBtn: { position:"absolute", top:"12px", right:"12px", background:"transparent", border:"1px solid #222", color:"#444", fontFamily:"inherit", fontSize:"10px", letterSpacing:"2px", padding:"4px 8px", cursor:"pointer", borderRadius:"2px", transition:"all 0.2s" },
  codeCopiedBtn: { borderColor:"#f0c040", color:"#f0c040" },
};

const docsCss = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700;800&family=DM+Serif+Display:ital@0;1&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: #0a0a0a; }

  .nav-link:hover    { color: #f0c040 !important; }
  .side-link:hover   { color: #f0c040 !important; }
  .lang-tab:hover    { border-color: #f0c040 !important; color: #f0c040 !important; }
  .play-run-btn:hover { opacity: 0.85; }
  .play-input::placeholder { color: #2a2a2a; }
  .copy-code-btn:hover { border-color: #f0c040 !important; color: #f0c040 !important; }

  /* ── Mobile ─────────────────────────────────── */
  @media (max-width: 768px) {
    /* Show hamburger, hide sidebar */
    .hamburger     { display: block !important; }
    .docs-sidebar  { display: none !important; }

    /* Full-width main */
    .docs-main-layout { flex-direction: column; }
  }

  @media (max-width: 600px) {
    nav { padding: 0 16px !important; }

    /* Shrink main padding */
    main { padding: 24px 16px 60px !important; }

    /* Section titles */
    h1 { font-size: 28px !important; letter-spacing: -1px !important; }
    h2 { font-size: 18px !important; }

    /* Code blocks: scroll horizontally, don't overflow */
    pre {
      font-size: 11px !important;
      overflow-x: auto !important;
      white-space: pre !important;
      -webkit-overflow-scrolling: touch;
    }

    /* Endpoint row wraps */
    .endpoint-row { flex-direction: column !important; align-items: flex-start !important; }

    /* Info grid single col */
    .info-grid { grid-template-columns: 1fr !important; }

    /* Param tables scroll */
    .param-table { overflow-x: auto !important; }

    /* Playground input */
    .play-input { font-size: 14px !important; letter-spacing: 2px !important; }
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #0a0a0a; }
  ::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }

  /* Sidebar scroll */
  aside::-webkit-scrollbar { width: 3px; }
`;
