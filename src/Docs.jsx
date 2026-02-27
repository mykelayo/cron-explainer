// src/Docs.jsx
import { useState } from "react";
import { useTheme } from "./theme.js";
import ThemeNav, { themeCSS } from "./ThemeNav.jsx";
import { SITE_URL, GITHUB_URL } from "./config.js";

// ─── CLIPBOARD HELPERS ────────────────────────────────────────────────────────

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => execCommandCopy(text));
  }
  return execCommandCopy(text);
}

function execCommandCopy(text) {
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
    document.body.appendChild(el);
    el.focus(); el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    return Promise.resolve();
  } catch {
    return Promise.reject(new Error("Copy not supported."));
  }
}


// ─── CODE SAMPLES ─────────────────────────────────────────────────────────────

const CODE = {
  curl: (url, expr) =>
`curl -X POST ${url}/api/explain \\
  -H "Content-Type: application/json" \\
  -d '{"cron": "${expr}"}'`,
  js: (url, expr) =>
`const res = await fetch("${url}/api/explain", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ cron: "${expr}" }),
});
const { explanation, nextRuns } = await res.json();`,
  python: (url, expr) =>
`import requests
data = requests.post("${url}/api/explain",
    json={"cron": "${expr}"}).json()
print(data["explanation"])`,
  node: (url, expr) =>
`const https = require("https");
const body = JSON.stringify({ cron: "${expr}" });
https.request({
  hostname: "${url.replace("https://","")}",
  path: "/api/explain", method: "POST",
  headers: { "Content-Type": "application/json",
             "Content-Length": Buffer.byteLength(body) }
}, res => {
  let d = ""; res.on("data", c => d += c);
  res.on("end", () => console.log(JSON.parse(d).explanation));
}).end(body);`,
};

const EXAMPLES = [
  { label:"Weekday 9am",  expr:"0 9 * * 1-5"  },
  { label:"Every 15min",  expr:"*/15 * * * *"  },
  { label:"Monthly",      expr:"0 0 1 * *"     },
  { label:"Every 6h",     expr:"0 */6 * * *"   },
  { label:"Fri 6:30pm",   expr:"30 18 * * 5"   },
  { label:"Every minute", expr:"* * * * *"     },
];

// ─── PLAYGROUND ───────────────────────────────────────────────────────────────

function Playground({ C }) {
  const [expr,   setExpr]   = useState("0 9 * * 1-5");
  const [lang,   setLang]   = useState("curl");
  const [result, setResult] = useState(null);
  const [loading,setLoading]= useState(false);
  const [copied, setCopied] = useState(false);

  async function run() {
    setLoading(true); setResult(null);
    try {
      const res = await fetch(`${SITE_URL}/api/explain`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ cron: expr }),
      });
      setResult({ ok: res.ok, data: await res.json() });
    } catch (e) { setResult({ ok:false, data:{ error:e.message } }); }
    finally { setLoading(false); }
  }

  const code = CODE[lang]?.(SITE_URL, expr) ?? "";

  return (
    <div style={{ background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:"6px", overflow:"hidden" }}>
      {/* Input row */}
      <div style={{ display:"flex", gap:"10px", padding:"18px", borderBottom:`1px solid ${C.border}`, flexWrap:"wrap", alignItems:"flex-end" }}>
        <div style={{ flex:1, minWidth:"200px" }}>
          <div style={{ fontSize:"9px", letterSpacing:"3px", color:C.textMuted, marginBottom:"8px" }}>EXPRESSION</div>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", background:C.card, border:`1px solid ${C.border2}`, borderRadius:"4px", padding:"10px 14px" }}>
            <span style={{ color:C.accent, fontSize:"15px", fontWeight:"bold" }}>$</span>
            <input value={expr} onChange={e=>setExpr(e.target.value)}
              style={{ background:"transparent", border:"none", outline:"none", color:C.text, fontSize:"15px", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"4px", width:"100%", caretColor:C.accent }}
              spellCheck={false} className="pg-input" />
          </div>
        </div>
        <button onClick={run} disabled={loading}
          style={{ background:C.accent, color:C.accentText, border:"none", padding:"10px 20px", fontSize:"12px", letterSpacing:"1px", fontFamily:"inherit", fontWeight:"700", cursor:"pointer", borderRadius:"3px", flexShrink:0, transition:"all 0.2s" }}
          className="pg-run">
          {loading ? "..." : "Run ▶"}
        </button>
      </div>

      {/* Endpoint hint */}
      <div style={{ padding:"9px 18px", fontSize:"11px", color:C.textMuted, borderBottom:`1px solid ${C.border}`, wordBreak:"break-all" }}>
        {SITE_URL}/api/explain
      </div>

      {/* Result */}
      {result && (
        <div style={{ margin:"14px 18px", background:C.card, border:`1px solid ${C.border}`, borderLeft:`3px solid ${result.ok?"#4caf50":"#cc3333"}`, borderRadius:"3px", padding:"12px 14px" }}>
          <div style={{ fontSize:"9px", letterSpacing:"2px", color:result.ok?"#4caf50":"#cc5555", marginBottom:"8px" }}>{result.ok?"200 OK":"ERROR"}</div>
          {/* overflow:auto so long JSON lines scroll instead of being clipped */}
          <pre style={{ margin:0, fontSize:"11px", color:C.textSub, lineHeight:"1.6", overflowX:"auto", whiteSpace:"pre", WebkitOverflowScrolling:"touch" }}>
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}

      {/* Language tabs */}
      <div style={{ display:"flex", gap:"4px", padding:"14px 18px 0", flexWrap:"wrap" }}>
        {Object.keys(CODE).map(l=>(
          <button key={l} onClick={()=>setLang(l)}
            style={{ background:"transparent", border:`1px solid ${lang===l?C.accent:C.border}`, color:lang===l?C.accent:C.textMuted, fontFamily:"inherit", fontSize:"11px", letterSpacing:"1px", padding:"5px 12px", cursor:"pointer", borderRadius:"3px", transition:"all 0.15s" }}
            className="lang-tab">{l}
          </button>
        ))}
      </div>

      {/* Code block
          outer div was overflow:"hidden" which clipped the inner pre's horizontal scroll.
               Changed to overflow:"auto" so wide code lines actually scroll. */}
      <div style={{ position:"relative", margin:"12px 18px 18px" }}>
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"16px 20px", overflow:"auto" }}>
          <pre style={{ margin:0, fontSize:"12px", color:C.textSub, lineHeight:"1.7", overflowX:"auto", whiteSpace:"pre", WebkitOverflowScrolling:"touch" }}>{code}</pre>
        </div>
        <button
          onClick={()=>{copyToClipboard(code).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1500);}).catch(()=>{});}}
          style={{ position:"absolute", top:"10px", right:"10px", background:"transparent", border:`1px solid ${copied?C.accent:C.border2}`, color:copied?C.accent:C.textMuted, fontFamily:"inherit", fontSize:"10px", letterSpacing:"2px", padding:"4px 8px", cursor:"pointer", borderRadius:"2px", transition:"all 0.2s" }}
          className="copy-btn">
          {copied?"✓":"COPY"}
        </button>
      </div>
    </div>
  );
}

// ─── DOCS PAGE ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id:"overview",   label:"Overview"              },
  { id:"endpoint",   label:"Endpoint", method:"POST"},
  { id:"request",    label:"Request"               },
  { id:"response",   label:"Response"              },
  { id:"errors",     label:"Errors"                },
  { id:"examples",   label:"Examples"              },
  { id:"playground", label:"Playground"            },
];

export default function Docs() {
  const { C } = useTheme();
  const [active,     setActive]     = useState("overview");
  const [lang,       setLang]       = useState("curl");
  const [drawerOpen, setDrawerOpen] = useState(false);

  function goTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior:"smooth" });
    setActive(id); setDrawerOpen(false);
  }

  const ic = (txt) => (
    <code style={{ background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:"3px", padding:"1px 6px", fontSize:"12px", color:C.accent, fontFamily:"inherit" }}>{txt}</code>
  );

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, transition:"background 0.2s, color 0.2s" }}>
      <style>{themeCSS(C)}{docsExtras(C)}</style>

      <ThemeNav links={[
        { href:"/",          label:"Home"      },
        { href:"/scheduler", label:"Scheduler" },
        { href:"/terms",     label:"Terms"     },
      ]} />

      {/* Mobile sidebar toggle */}
      <div style={{ display:"none" }} className="docs-mobile-bar">
        <button onClick={()=>setDrawerOpen(o=>!o)}
          style={{ background:C.card, border:`1px solid ${C.border}`, color:C.textSub, fontSize:"12px", letterSpacing:"1px", padding:"10px 16px", cursor:"pointer", fontFamily:"inherit", width:"100%", textAlign:"left" }}>
          {drawerOpen ? "✕ Close menu" : "☰ API Reference"}
        </button>
        {drawerOpen && (
          <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:"12px 16px", display:"flex", flexDirection:"column", gap:"4px" }}>
            {NAV_ITEMS.map(n=>(
              <button key={n.id} onClick={()=>goTo(n.id)}
                style={{ background:"transparent", border:"none", color:active===n.id?C.accent:C.textSub, textAlign:"left", padding:"8px 12px", cursor:"pointer", fontFamily:"inherit", fontSize:"13px", borderRadius:"3px" }}>
                {n.method && <span style={{ background:C.greenBg, color:C.green, fontSize:"9px", padding:"2px 6px", borderRadius:"2px", marginRight:"8px" }}>{n.method}</span>}
                {n.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display:"flex", maxWidth:"1180px", margin:"0 auto", minHeight:"calc(100vh - 60px)" }}>

        {/* Sidebar — hidden on mobile via CSS */}
        <aside style={{ width:"200px", flexShrink:0, padding:"32px 0 32px 24px", borderRight:`1px solid ${C.border}`, position:"sticky", top:"60px", height:"calc(100vh - 60px)", overflowY:"auto" }} className="docs-sidebar">
          <div style={{ fontSize:"9px", letterSpacing:"3px", color:C.textMuted, marginBottom:"12px" }}>API REFERENCE</div>
          {NAV_ITEMS.map(n=>(
            <button key={n.id} onClick={()=>goTo(n.id)}
              style={{ background:"transparent", border:"none", display:"flex", alignItems:"center", gap:"6px", padding:"6px 4px", color:active===n.id?C.accent:C.textSub, cursor:"pointer", fontSize:"12px", letterSpacing:"0.5px", transition:"color 0.15s", width:"100%", textAlign:"left", fontFamily:"inherit" }}
              className="side-btn">
              {n.method && <span style={{ background:C.greenBg, color:C.green, fontSize:"9px", padding:"2px 5px", borderRadius:"2px" }}>{n.method}</span>}
              {n.label}
            </button>
          ))}
          <div style={{ marginTop:"24px", borderTop:`1px solid ${C.border}`, paddingTop:"16px" }}>
            <div style={{ fontSize:"9px", letterSpacing:"3px", color:C.textMuted, marginBottom:"10px" }}>LINKS</div>
            {[
              {href:"/",label:"← Home"},
              {href:"/scheduler",label:"⏰ Scheduler"},
              {href:GITHUB_URL,label:"GitHub ↗",ext:true},
            ].map(l=>(
              <a key={l.href} href={l.href} target={l.ext?"_blank":undefined} rel={l.ext?"noreferrer":undefined}
                style={{ display:"block", color:C.textSub, textDecoration:"none", fontSize:"12px", padding:"5px 4px", transition:"color 0.15s" }} className="side-btn">{l.label}
              </a>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex:1, padding:"clamp(24px,4vw,44px) clamp(16px,4vw,40px) 80px", minWidth:0 }}>

          {/* Overview */}
          <section id="overview" style={{ maxWidth:"700px", marginBottom:"56px" }}>
            <div style={{ fontSize:"9px", letterSpacing:"4px", color:C.textMuted, marginBottom:"14px" }}>API REFERENCE</div>
            <h1 style={{ fontSize:"clamp(26px,5vw,44px)", fontWeight:"800", color:C.text, margin:"0 0 18px", letterSpacing:"-1.5px", fontFamily:"'DM Serif Display',Georgia,serif" }}>Cron.Explain API</h1>
            <p style={{ fontSize:"14px", color:C.textSub, lineHeight:"1.85", margin:"0 0 24px" }}>A simple REST API that takes a cron expression and returns a plain-English explanation, field breakdown, and next scheduled run times. Free. No API key required.</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:"1px", border:`1px solid ${C.border}`, borderRadius:"4px", overflow:"hidden" }}>
              {[["BASE URL",SITE_URL],["AUTH","None required"],["RATE LIMIT","60 req / min"],["FORMAT","JSON"]].map(([l,v])=>(
                <div key={l} style={{ background:C.inputBg, padding:"14px 16px" }}>
                  <div style={{ fontSize:"9px", letterSpacing:"2px", color:C.textMuted, marginBottom:"5px" }}>{l}</div>
                  <div style={{ fontSize:"12px", color:C.text, wordBreak:"break-all" }}>{v}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Endpoint */}
          <section id="endpoint" style={{ maxWidth:"700px", marginBottom:"56px" }}>
            <h2 style={{ fontSize:"20px", fontWeight:"700", color:C.text, margin:"0 0 16px" }}>Endpoint</h2>
            <div style={{ display:"flex", alignItems:"center", gap:"12px", background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"14px 18px", marginBottom:"16px", flexWrap:"wrap" }}>
              <span style={{ background:C.greenBg, color:C.green, fontSize:"12px", fontWeight:"700", padding:"4px 10px", borderRadius:"3px", letterSpacing:"1px", flexShrink:0 }}>POST</span>
              <span style={{ fontSize:"15px", color:C.text, letterSpacing:"1px", wordBreak:"break-all" }}>/api/explain</span>
            </div>
            <p style={{ fontSize:"14px", color:C.textSub, lineHeight:"1.85", margin:0 }}>Accepts a JSON body with a {ic("cron")} field. Returns explanation synchronously. No authentication required.</p>
          </section>

          {/* Request */}
          <section id="request" style={{ maxWidth:"700px", marginBottom:"56px" }}>
            <h2 style={{ fontSize:"20px", fontWeight:"700", color:C.text, margin:"0 0 16px" }}>Request</h2>
            <p style={{ fontSize:"14px", color:C.textSub, lineHeight:"1.85", margin:"0 0 16px" }}>Send a {ic("POST")} request with {ic("Content-Type: application/json")}.</p>
            <div style={{ border:`1px solid ${C.border}`, borderRadius:"4px", overflow:"auto" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 80px 2fr", background:C.inputBg, padding:"10px 16px", fontSize:"9px", letterSpacing:"2px", color:C.textMuted, gap:"12px", minWidth:"400px" }}>
                <span>Field</span><span>Type</span><span>Req</span><span>Description</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 80px 2fr", padding:"12px 16px", borderTop:`1px solid ${C.border}`, fontSize:"12px", gap:"12px", alignItems:"start", minWidth:"400px" }}>
                {ic("cron")}<span style={{ color:"#5588aa" }}>string</span><span style={{ color:C.accent }}>yes</span>
                <span style={{ color:C.textSub }}>A 5-field cron expression (e.g. {ic("0 9 * * 1-5")})</span>
              </div>
            </div>
            <div style={{ background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"16px 20px", marginTop:"14px", overflowX:"auto" }}>
              <pre style={{ margin:0, fontSize:"12px", color:C.textSub, lineHeight:"1.7", whiteSpace:"pre" }}>{`{ "cron": "0 9 * * 1-5" }`}</pre>
            </div>
          </section>

          {/* Response */}
          <section id="response" style={{ maxWidth:"700px", marginBottom:"56px" }}>
            <h2 style={{ fontSize:"20px", fontWeight:"700", color:C.text, margin:"0 0 16px" }}>Response</h2>
            <div style={{ background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"16px 20px", marginBottom:"16px", overflowX:"auto" }}>
              <pre style={{ margin:0, fontSize:"12px", color:C.textSub, lineHeight:"1.7", whiteSpace:"pre", WebkitOverflowScrolling:"touch" }}>{`{
  "cron": "0 9 * * 1-5",
  "explanation": "At 9:00 AM, Monday through Friday",
  "fields": {
    "minute":     { "value": "0",   "meaning": "at minute 0" },
    "hour":       { "value": "9",   "meaning": "at 9" },
    "dayOfMonth": { "value": "*",   "meaning": "every day" },
    "month":      { "value": "*",   "meaning": "every month" },
    "dayOfWeek":  { "value": "1-5", "meaning": "Monday through Friday" }
  },
  "nextRuns": [
    "2026-02-24T09:00:00.000Z",
    "2026-02-25T09:00:00.000Z",
    "2026-02-26T09:00:00.000Z"
  ]
}`}</pre>
            </div>
          </section>

          {/* Errors */}
          <section id="errors" style={{ maxWidth:"700px", marginBottom:"56px" }}>
            <h2 style={{ fontSize:"20px", fontWeight:"700", color:C.text, margin:"0 0 16px" }}>Errors</h2>
            <div style={{ border:`1px solid ${C.border}`, borderRadius:"4px", overflow:"hidden", marginBottom:"16px" }}>
              {[["400","Missing or invalid cron expression"],["405","Wrong HTTP method. Use POST."],["429","Rate limit exceeded (60 req/min)"],["500","Internal server error"]].map(([s,m])=>(
                <div key={s} style={{ display:"flex", gap:"16px", padding:"12px 16px", borderBottom:`1px solid ${C.border}`, fontSize:"13px", flexWrap:"wrap" }}>
                  <span style={{ color:C.accent, width:"36px", flexShrink:0 }}>{s}</span>
                  <span style={{ color:C.textSub }}>{m}</span>
                </div>
              ))}
            </div>
            <div style={{ background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"16px 20px", overflowX:"auto" }}>
              <pre style={{ margin:0, fontSize:"12px", color:C.textSub, whiteSpace:"pre" }}>{`{ "error": "Invalid cron expression. Expected 5 fields." }`}</pre>
            </div>
          </section>

          {/* Examples */}
          <section id="examples" style={{ maxWidth:"700px", marginBottom:"56px" }}>
            <h2 style={{ fontSize:"20px", fontWeight:"700", color:C.text, margin:"0 0 16px" }}>Code examples</h2>
            <div style={{ display:"flex", gap:"4px", marginBottom:"12px", flexWrap:"wrap" }}>
              {Object.keys(CODE).map(l=>(
                <button key={l} onClick={()=>setLang(l)}
                  style={{ background:"transparent", border:`1px solid ${lang===l?C.accent:C.border}`, color:lang===l?C.accent:C.textMuted, fontFamily:"inherit", fontSize:"11px", letterSpacing:"1px", padding:"5px 12px", cursor:"pointer", borderRadius:"3px", transition:"all 0.15s" }}
                  className="lang-tab">{l}
                </button>
              ))}
            </div>
            {/* FIX: overflow was "hidden" — changed to "auto" so long lines scroll */}
            <div style={{ background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"16px 20px", overflow:"auto" }}>
              <pre style={{ margin:0, fontSize:"12px", color:C.textSub, lineHeight:"1.7", whiteSpace:"pre", WebkitOverflowScrolling:"touch" }}>
                {CODE[lang]?.(SITE_URL, EXAMPLES[0].expr)}
              </pre>
            </div>
          </section>

          {/* Playground */}
          <section id="playground" style={{ maxWidth:"700px", marginBottom:"56px" }}>
            <h2 style={{ fontSize:"20px", fontWeight:"700", color:C.text, margin:"0 0 10px" }}>Live playground</h2>
            <p style={{ fontSize:"13px", color:C.textSub, margin:"0 0 20px" }}>Test the API directly. Your request hits the real endpoint.</p>
            <Playground C={C} />
          </section>

        </main>
      </div>
    </div>
  );
}

function docsExtras(C) {
  return `
    .docs-sidebar    { display: flex !important; flex-direction: column; }
    .docs-mobile-bar { display: none !important; }
    .side-btn:hover  { color: ${C.accent} !important; }
    .lang-tab:hover  { border-color: ${C.accent} !important; color: ${C.accent} !important; }
    .pg-input::placeholder { color: ${C.border2}; }
    .pg-input:focus  { outline: none; }
    .pg-run:hover    { opacity: 0.85; }
    .copy-btn:hover  { border-color: ${C.accent} !important; color: ${C.accent} !important; }

    @media (max-width: 720px) {
      .docs-sidebar    { display: none !important; }
      .docs-mobile-bar { display: block !important; }
    }
    @media (max-width: 500px) {
      main { padding: 20px 14px 60px !important; }
    }
  `;
}
