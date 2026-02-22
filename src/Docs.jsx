import { useState } from "react";

const BASE_URL = "https://timely-flan-0ca3c1.netlify.app";

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

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState("curl");
  const [testExpr, setTestExpr] = useState("0 9 * * 1-5");
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  async function runTest() {
    setLoading(true);
    setError(null);
    setTestResult(null);
    try {
      const res = await fetch(`${BASE_URL}/api/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cron: testExpr }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Request failed");
      else setTestResult(data);
    } catch (e) {
      setError("Network error — is the API reachable?");
    }
    setLoading(false);
  }

  function copyCode() {
    navigator.clipboard.writeText(CODE_SAMPLES[activeTab](testExpr));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={S.root}>
      <style>{css}</style>

      {/* ── NAV ── */}
      <nav style={S.nav}>
        <a href="/" style={S.navLogo} className="nav-logo">
          CRON<span style={S.accent}>.EXPLAIN</span>
        </a>
        <div style={S.navLinks}>
          <a href="/" style={S.navLink} className="d-link">← Back to app</a>
          <a href="https://github.com" target="_blank" rel="noreferrer" style={S.navLink} className="d-link">GitHub</a>
        </div>
      </nav>

      <div style={S.layout}>

        {/* ── SIDEBAR ── */}
        <aside style={S.sidebar}>
          <div style={S.sideSection}>
            <div style={S.sideLabel}>OVERVIEW</div>
            <a href="#intro"    style={S.sideLink} className="s-link">Introduction</a>
            <a href="#base-url" style={S.sideLink} className="s-link">Base URL</a>
            <a href="#auth"     style={S.sideLink} className="s-link">Authentication</a>
          </div>
          <div style={S.sideSection}>
            <div style={S.sideLabel}>ENDPOINTS</div>
            <a href="#post-explain" style={S.sideLink} className="s-link">
              <span style={S.methodTag}>POST</span> /explain
            </a>
          </div>
          <div style={S.sideSection}>
            <div style={S.sideLabel}>REFERENCE</div>
            <a href="#request"  style={S.sideLink} className="s-link">Request body</a>
            <a href="#response" style={S.sideLink} className="s-link">Response schema</a>
            <a href="#errors"   style={S.sideLink} className="s-link">Error codes</a>
            <a href="#examples" style={S.sideLink} className="s-link">Examples</a>
          </div>
          <div style={S.sideSection}>
            <div style={S.sideLabel}>TRY IT</div>
            <a href="#playground" style={S.sideLink} className="s-link">Live playground</a>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main style={S.main}>

          {/* INTRO */}
          <section id="intro" style={S.section}>
            <div style={S.pageLabel}>API REFERENCE</div>
            <h1 style={S.pageTitle}>Cron.Explain API</h1>
            <p style={S.lead}>
              A free, open REST API that parses cron expressions into plain English,
              breaks down each field, and returns the next 5 scheduled run times.
              No API key. No rate limits. No sign-up.
            </p>
            <div style={S.infoGrid}>
              {[
                { label:"Version",   val:"v1" },
                { label:"Protocol",  val:"HTTPS" },
                { label:"Format",    val:"JSON" },
                { label:"Auth",      val:"None required" },
                { label:"Rate limit",val:"None" },
                { label:"Cost",      val:"Free forever" },
              ].map((item,i) => (
                <div key={i} style={S.infoItem}>
                  <div style={S.infoLabel}>{item.label}</div>
                  <div style={S.infoVal}>{item.val}</div>
                </div>
              ))}
            </div>
          </section>

          <div style={S.divider} />

          {/* BASE URL */}
          <section id="base-url" style={S.section}>
            <h2 style={S.h2}>Base URL</h2>
            <div style={S.codeBlock}>
              <span style={S.codeComment}># All API requests go to this base URL</span>
              {"\n"}
              <span style={S.codeVal}>{BASE_URL}/api</span>
            </div>
          </section>

          <div style={S.divider} />

          {/* AUTH */}
          <section id="auth" style={S.section}>
            <h2 style={S.h2}>Authentication</h2>
            <p style={S.body}>
              No authentication required. The API is completely open and free.
              Just make your request and get your response.
            </p>
            <div style={S.alertBox}>
              <span style={S.alertIcon}>ℹ</span>
              <span>If you're building something that calls this API heavily, please consider self-hosting — clone the repo and deploy your own instance on Netlify for free.</span>
            </div>
          </section>

          <div style={S.divider} />

          {/* ENDPOINT */}
          <section id="post-explain" style={S.section}>
            <div style={S.endpointHeader}>
              <span style={S.endpointMethod}>POST</span>
              <span style={S.endpointPath}>/api/explain</span>
            </div>
            <p style={S.body}>
              Parses a cron expression and returns a plain-English explanation,
              a breakdown of all 5 fields, and the next 5 scheduled run times in ISO 8601 format.
            </p>
          </section>

          <div style={S.divider} />

          {/* REQUEST */}
          <section id="request" style={S.section}>
            <h2 style={S.h2}>Request Body</h2>
            <p style={S.body}>Send a JSON body with a single field:</p>

            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Field</th>
                  <th style={S.th}>Type</th>
                  <th style={S.th}>Required</th>
                  <th style={S.th}>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr style={S.tr} className="t-row">
                  <td style={S.td}><code style={S.inlineCode}>cron</code></td>
                  <td style={S.td}><span style={S.typeTag}>string</span></td>
                  <td style={S.td}><span style={S.required}>Yes</span></td>
                  <td style={S.td}>A valid 5-field cron expression</td>
                </tr>
              </tbody>
            </table>

            <div style={S.codeBlock}>
              <span style={S.codeComment}>{"// Example request body\n"}</span>
              {"{\n"}
              {"  "}<span style={S.codeKey}>"cron"</span>{": "}<span style={S.codeStr}>"0 9 * * 1-5"</span>{"\n"}
              {"}"}
            </div>
          </section>

          <div style={S.divider} />

          {/* RESPONSE */}
          <section id="response" style={S.section}>
            <h2 style={S.h2}>Response Schema</h2>
            <p style={S.body}>A successful response returns HTTP <code style={S.inlineCode}>200</code> with this JSON structure:</p>

            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Field</th>
                  <th style={S.th}>Type</th>
                  <th style={S.th}>Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { field:"expression",  type:"string",   desc:"The original cron expression, trimmed" },
                  { field:"explanation", type:"string",   desc:"Plain-English sentence describing the schedule" },
                  { field:"fields",      type:"object",   desc:"Breakdown of all 5 cron fields" },
                  { field:"nextRuns",    type:"string[]", desc:"Array of 5 ISO 8601 UTC timestamps for upcoming runs" },
                ].map((row, i) => (
                  <tr key={i} style={S.tr} className="t-row">
                    <td style={S.td}><code style={S.inlineCode}>{row.field}</code></td>
                    <td style={S.td}><span style={S.typeTag}>{row.type}</span></td>
                    <td style={S.td}>{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={S.codeBlock}>
              <span style={S.codeComment}>{"// Example response\n"}</span>
              {"{\n"}
              {"  "}<span style={S.codeKey}>"expression"</span>{":  "}<span style={S.codeStr}>"0 9 * * 1-5"</span>{",\n"}
              {"  "}<span style={S.codeKey}>"explanation"</span>{": "}<span style={S.codeStr}>"At 9:00 AM, on Monday through Friday"</span>{",\n"}
              {"  "}<span style={S.codeKey}>"fields"</span>{": {\n"}
              {"    "}<span style={S.codeKey}>"minute"</span>{":{     "}<span style={S.codeKey}>"raw"</span>:{" "}<span style={S.codeStr}>"0"</span>{",   "}<span style={S.codeKey}>"parsed"</span>:{" "}<span style={S.codeStr}>"0"</span>{" },\n"}
              {"    "}<span style={S.codeKey}>"hour"</span>{":{       "}<span style={S.codeKey}>"raw"</span>:{" "}<span style={S.codeStr}>"9"</span>{",   "}<span style={S.codeKey}>"parsed"</span>:{" "}<span style={S.codeStr}>"9"</span>{" },\n"}
              {"    "}<span style={S.codeKey}>"dayOfMonth"</span>{":{  "}<span style={S.codeKey}>"raw"</span>:{" "}<span style={S.codeStr}>"*"</span>{",   "}<span style={S.codeKey}>"parsed"</span>:{" "}<span style={S.codeStr}>"every"</span>{" },\n"}
              {"    "}<span style={S.codeKey}>"month"</span>{":{       "}<span style={S.codeKey}>"raw"</span>:{" "}<span style={S.codeStr}>"*"</span>{",   "}<span style={S.codeKey}>"parsed"</span>:{" "}<span style={S.codeStr}>"every"</span>{" },\n"}
              {"    "}<span style={S.codeKey}>"dayOfWeek"</span>{":{   "}<span style={S.codeKey}>"raw"</span>:{" "}<span style={S.codeStr}>"1-5"</span>{", "}<span style={S.codeKey}>"parsed"</span>:{" "}<span style={S.codeStr}>"Monday through Friday"</span>{" }\n"}
              {"  },\n"}
              {"  "}<span style={S.codeKey}>"nextRuns"</span>{": [\n"}
              {"    "}<span style={S.codeStr}>"2026-02-23T09:00:00.000Z"</span>{",\n"}
              {"    "}<span style={S.codeStr}>"2026-02-24T09:00:00.000Z"</span>{",\n"}
              {"    "}<span style={S.codeStr}>"2026-02-25T09:00:00.000Z"</span>{",\n"}
              {"    "}<span style={S.codeStr}>"2026-02-26T09:00:00.000Z"</span>{",\n"}
              {"    "}<span style={S.codeStr}>"2026-02-27T09:00:00.000Z"</span>{"\n"}
              {"  ]\n}"}
            </div>
          </section>

          <div style={S.divider} />

          {/* ERRORS */}
          <section id="errors" style={S.section}>
            <h2 style={S.h2}>Error Codes</h2>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Meaning</th>
                  <th style={S.th}>Common cause</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { status:"400", meaning:"Bad Request",      cause:"Invalid JSON body, or missing cron field" },
                  { status:"405", meaning:"Method Not Allowed", cause:"Using GET instead of POST" },
                  { status:"422", meaning:"Unprocessable",    cause:"Cron expression is malformed or not 5 fields" },
                ].map((row,i) => (
                  <tr key={i} style={S.tr} className="t-row">
                    <td style={S.td}><code style={{...S.inlineCode, color:"#cc5555"}}>{row.status}</code></td>
                    <td style={S.td}>{row.meaning}</td>
                    <td style={S.td} >{row.cause}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={S.codeBlock}>
              <span style={S.codeComment}>{"// Error response shape\n"}</span>
              {"{\n  "}<span style={S.codeKey}>"error"</span>{": "}<span style={S.codeStr}>"Expression must have exactly 5 fields: minute hour dom month dow"</span>{"\n}"}
            </div>
          </section>

          <div style={S.divider} />

          {/* CODE EXAMPLES */}
          <section id="examples" style={S.section}>
            <h2 style={S.h2}>Code Examples</h2>
            <p style={S.body}>Choose your language. The input field is live — change the expression and the code updates.</p>

            <div style={S.exprInput}>
              <span style={S.exprLabel}>EXPRESSION</span>
              <input
                style={S.exprField}
                value={testExpr}
                onChange={e => setTestExpr(e.target.value)}
                spellCheck={false}
                className="expr-input"
              />
            </div>

            <div style={S.tabs}>
              {Object.keys(CODE_SAMPLES).map(lang => (
                <button key={lang} style={{...S.tab, ...(activeTab===lang ? S.tabActive : {})}}
                  className={`lang-tab ${activeTab===lang?"active":""}`}
                  onClick={() => setActiveTab(lang)}>
                  {lang}
                </button>
              ))}
              <button style={S.copyCodeBtn} className="copy-code-btn" onClick={copyCode}>
                {copied ? "✓ copied" : "copy"}
              </button>
            </div>

            <div style={S.codeBlock}>
              <pre style={S.pre}>{CODE_SAMPLES[activeTab](testExpr)}</pre>
            </div>

            <div style={S.exGrid}>
              {EXAMPLES.map((ex,i) => (
                <button key={i} style={S.exBtn} className="ex-btn" onClick={() => setTestExpr(ex.expr)}>
                  <span style={S.exExpr}>{ex.expr}</span>
                  <span style={S.exLabel}>{ex.label}</span>
                </button>
              ))}
            </div>
          </section>

          <div style={S.divider} />

          {/* PLAYGROUND */}
          <section id="playground" style={S.section}>
            <h2 style={S.h2}>Live Playground</h2>
            <p style={S.body}>Test the API directly from this page. No terminal needed.</p>

            <div style={S.playground}>
              <div style={S.playHeader}>
                <div style={S.playMethod}>POST</div>
                <div style={S.playUrl}>{BASE_URL}/api/explain</div>
              </div>

              <div style={S.playBody}>
                <div style={S.playLabel}>REQUEST BODY</div>
                <div style={S.playInputRow}>
                  <span style={S.playKey}>"cron":</span>
                  <input
                    style={S.playInput}
                    value={testExpr}
                    onChange={e => setTestExpr(e.target.value)}
                    spellCheck={false}
                    className="play-input"
                    placeholder="* * * * *"
                  />
                </div>
                <button
                  style={{...S.runBtn, ...(loading ? S.runBtnLoading : {})}}
                  onClick={runTest}
                  disabled={loading}
                  className="run-btn"
                >
                  {loading ? "RUNNING..." : "▶  SEND REQUEST"}
                </button>
              </div>

              {error && (
                <div style={S.playError} className="fade-in">
                  <div style={S.playResLabel}>RESPONSE — ERROR</div>
                  <pre style={S.pre}>{JSON.stringify({ error }, null, 2)}</pre>
                </div>
              )}

              {testResult && (
                <div style={S.playResponse} className="fade-in">
                  <div style={S.playResHeader}>
                    <div style={S.playResLabel}>RESPONSE</div>
                    <div style={S.playStatus200}>200 OK</div>
                  </div>
                  <pre style={S.pre}>{JSON.stringify(testResult, null, 2)}</pre>
                </div>
              )}
            </div>
          </section>

        </main>
      </div>

      {/* FOOTER */}
      <footer style={S.footer}>
        <span style={S.footerText}>CRON<span style={S.accent}>.EXPLAIN</span> — Free forever. MIT License.</span>
        <a href="/" style={S.footerLink} className="d-link">← Back to app</a>
      </footer>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const S = {
  root: { background:"#0a0a0a", minHeight:"100vh", fontFamily:"'IBM Plex Mono','Courier New',monospace", color:"#ccc" },
  accent: { color:"#f0c040" },

  nav: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 32px", borderBottom:"1px solid #181818", background:"#0a0a0a", position:"sticky", top:0, zIndex:100 },
  navLogo: { fontSize:"16px", fontWeight:"800", color:"#fff", textDecoration:"none", letterSpacing:"-0.5px" },
  navLinks: { display:"flex", gap:"24px" },
  navLink: { color:"#555", textDecoration:"none", fontSize:"12px", letterSpacing:"1px", transition:"color 0.2s" },

  layout: { display:"flex", maxWidth:"1200px", margin:"0 auto", minHeight:"calc(100vh - 61px)" },

  sidebar: { width:"220px", flexShrink:0, padding:"40px 0 40px 32px", borderRight:"1px solid #141414", position:"sticky", top:"61px", height:"calc(100vh - 61px)", overflowY:"auto" },
  sideSection: { marginBottom:"32px" },
  sideLabel: { fontSize:"9px", letterSpacing:"3px", color:"#333", marginBottom:"12px" },
  sideLink: { display:"flex", alignItems:"center", gap:"8px", padding:"5px 0", color:"#555", textDecoration:"none", fontSize:"12px", letterSpacing:"0.5px", transition:"color 0.15s" },
  methodTag: { background:"#1a2a1a", color:"#4caf50", fontSize:"9px", padding:"2px 6px", borderRadius:"2px", letterSpacing:"1px" },

  main: { flex:1, padding:"40px 40px 80px", maxWidth:"760px" },
  section: { marginBottom:"0" },
  divider: { height:"1px", background:"#141414", margin:"48px 0" },

  pageLabel: { fontSize:"10px", letterSpacing:"4px", color:"#444", marginBottom:"16px" },
  pageTitle: { fontSize:"clamp(32px,5vw,52px)", fontWeight:"800", color:"#fff", margin:"0 0 20px 0", letterSpacing:"-1.5px", fontFamily:"'DM Serif Display','Georgia',serif" },
  lead: { fontSize:"15px", color:"#666", lineHeight:"1.8", margin:"0 0 32px 0" },

  infoGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px,1fr))", gap:"1px", border:"1px solid #181818", borderRadius:"4px", overflow:"hidden" },
  infoItem: { background:"#0f0f0f", padding:"16px 18px" },
  infoLabel: { fontSize:"10px", letterSpacing:"2px", color:"#444", marginBottom:"6px" },
  infoVal: { fontSize:"13px", color:"#ccc" },

  h2: { fontSize:"22px", fontWeight:"700", color:"#fff", margin:"0 0 16px 0", letterSpacing:"-0.5px" },
  body: { fontSize:"14px", color:"#666", lineHeight:"1.8", margin:"0 0 20px 0" },

  endpointHeader: { display:"flex", alignItems:"center", gap:"16px", background:"#0f0f0f", border:"1px solid #181818", borderRadius:"4px", padding:"16px 20px", marginBottom:"20px" },
  endpointMethod: { background:"#1a2a1a", color:"#4caf50", fontSize:"12px", fontWeight:"700", padding:"4px 10px", borderRadius:"3px", letterSpacing:"1px" },
  endpointPath: { fontSize:"16px", color:"#fff", letterSpacing:"1px" },

  codeBlock: { background:"#0d0d0d", border:"1px solid #1a1a1a", borderRadius:"4px", padding:"20px 24px", fontSize:"13px", lineHeight:"1.8", overflowX:"auto", margin:"16px 0", whiteSpace:"pre" },
  pre: { margin:0, fontSize:"12px", lineHeight:"1.7", color:"#ccc", overflowX:"auto", whiteSpace:"pre-wrap", wordBreak:"break-all" },
  codeComment: { color:"#3a3a3a" },
  codeKey: { color:"#f0c040" },
  codeStr: { color:"#4caf50" },
  codeVal: { color:"#ccc" },
  inlineCode: { background:"#161616", border:"1px solid #1e1e1e", borderRadius:"3px", padding:"1px 6px", fontSize:"12px", color:"#f0c040" },

  alertBox: { background:"#0a0f1a", border:"1px solid #1a2a3a", borderLeft:"3px solid #3a6a9a", borderRadius:"4px", padding:"14px 18px", fontSize:"13px", color:"#557799", display:"flex", gap:"12px", alignItems:"flex-start" },
  alertIcon: { flexShrink:0, fontSize:"14px", marginTop:"1px" },

  table: { width:"100%", borderCollapse:"collapse", border:"1px solid #181818", borderRadius:"4px", overflow:"hidden", marginBottom:"20px", fontSize:"13px" },
  th: { background:"#0d0d0d", color:"#444", padding:"10px 16px", textAlign:"left", fontSize:"10px", letterSpacing:"2px", borderBottom:"1px solid #181818" },
  tr: { borderBottom:"1px solid #141414" },
  td: { padding:"12px 16px", color:"#888", verticalAlign:"top" },
  typeTag: { background:"#1a1a2a", color:"#7777cc", fontSize:"11px", padding:"2px 7px", borderRadius:"2px", letterSpacing:"0.5px" },
  required: { color:"#cc5555", fontSize:"11px" },

  exprInput: { display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px", background:"#0d0d0d", border:"1px solid #1e1e1e", padding:"12px 16px", borderRadius:"4px" },
  exprLabel: { fontSize:"9px", letterSpacing:"3px", color:"#444", flexShrink:0 },
  exprField: { background:"transparent", border:"none", outline:"none", color:"#f0c040", fontSize:"16px", fontFamily:"inherit", letterSpacing:"4px", flex:1, caretColor:"#f0c040" },

  tabs: { display:"flex", alignItems:"center", gap:"2px", marginBottom:"0", borderBottom:"1px solid #1a1a1a", paddingBottom:"0" },
  tab: { background:"transparent", border:"1px solid transparent", borderBottom:"none", color:"#444", fontFamily:"inherit", fontSize:"11px", letterSpacing:"1px", padding:"8px 14px", cursor:"pointer", transition:"all 0.15s", borderRadius:"3px 3px 0 0" },
  tabActive: { background:"#0d0d0d", border:"1px solid #1a1a1a", borderBottom:"1px solid #0d0d0d", color:"#f0c040", marginBottom:"-1px" },
  copyCodeBtn: { marginLeft:"auto", background:"transparent", border:"1px solid #1a1a1a", color:"#444", fontFamily:"inherit", fontSize:"10px", letterSpacing:"1px", padding:"5px 10px", cursor:"pointer", borderRadius:"2px", transition:"all 0.2s" },

  exGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:"6px", marginTop:"16px" },
  exBtn: { background:"#0d0d0d", border:"1px solid #181818", borderRadius:"3px", padding:"10px 14px", cursor:"pointer", textAlign:"left", display:"flex", flexDirection:"column", gap:"3px", fontFamily:"inherit", transition:"all 0.15s" },
  exExpr: { color:"#f0c040", fontSize:"12px", letterSpacing:"1px" },
  exLabel: { color:"#444", fontSize:"10px" },

  playground: { background:"#0d0d0d", border:"1px solid #1e1e1e", borderRadius:"6px", overflow:"hidden" },
  playHeader: { display:"flex", alignItems:"center", gap:"14px", padding:"14px 20px", background:"#111", borderBottom:"1px solid #1a1a1a" },
  playMethod: { background:"#1a2a1a", color:"#4caf50", fontSize:"11px", fontWeight:"700", padding:"4px 10px", borderRadius:"3px", letterSpacing:"1px" },
  playUrl: { fontSize:"13px", color:"#555", letterSpacing:"0.5px" },
  playBody: { padding:"20px" },
  playLabel: { fontSize:"9px", letterSpacing:"3px", color:"#333", marginBottom:"12px" },
  playInputRow: { display:"flex", alignItems:"center", gap:"10px", marginBottom:"16px", background:"#111", border:"1px solid #1e1e1e", padding:"12px 16px", borderRadius:"3px" },
  playKey: { color:"#f0c040", fontSize:"13px", flexShrink:0 },
  playInput: { background:"transparent", border:"none", outline:"none", color:"#fff", fontSize:"15px", fontFamily:"inherit", letterSpacing:"4px", flex:1, caretColor:"#f0c040" },
  runBtn: { background:"#f0c040", color:"#000", border:"none", padding:"12px 24px", fontSize:"12px", letterSpacing:"2px", fontFamily:"inherit", fontWeight:"700", cursor:"pointer", borderRadius:"2px", transition:"all 0.2s", width:"100%" },
  runBtnLoading: { background:"#555", color:"#888", cursor:"not-allowed" },
  playResponse: { borderTop:"1px solid #1a1a1a", padding:"20px" },
  playResHeader: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" },
  playResLabel: { fontSize:"9px", letterSpacing:"3px", color:"#444" },
  playStatus200: { background:"#1a2a1a", color:"#4caf50", fontSize:"10px", padding:"3px 8px", borderRadius:"2px", letterSpacing:"1px" },
  playError: { borderTop:"1px solid #2a1010", padding:"20px", background:"#100808" },

  footer: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 32px", borderTop:"1px solid #141414", fontSize:"12px" },
  footerText: { color:"#333", letterSpacing:"0.5px" },
  footerLink: { color:"#555", textDecoration:"none", letterSpacing:"1px", transition:"color 0.2s" },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700;800&family=DM+Serif+Display:ital@0;1&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: #0a0a0a; }

  .nav-logo:hover span { color: #ffd85c; }
  .d-link:hover { color: #f0c040 !important; }
  .s-link:hover { color: #ccc !important; }

  .t-row:last-child td { border-bottom: none; }
  .t-row:hover td { background: #0f0f0f; }

  .lang-tab:hover { color: #ccc !important; }
  .lang-tab.active { pointer-events: none; }
  .copy-code-btn:hover { color: #f0c040 !important; border-color: #2a2a2a !important; }

  .ex-btn:hover { border-color: #2a2a2a !important; background: #111 !important; }

  .expr-input:focus { outline: none; }
  .play-input:focus { outline: none; }
  .run-btn:hover:not(:disabled) { background: #ffd85c !important; transform: translateY(-1px); }

  .fade-in { animation: fadeUp 0.25s ease forwards; }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  ::selection { background: #f0c04022; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #0a0a0a; }
  ::-webkit-scrollbar-thumb { background: #1e1e1e; }
`;
