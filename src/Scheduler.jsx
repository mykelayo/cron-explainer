// src/Scheduler.jsx
import { useState, useEffect } from "react";
import { useTheme } from "./theme.js";
import ThemeNav, { themeCSS } from "./ThemeNav.jsx";

// ─── CRON UTILS ───────────────────────────────────────────────────────────────
// matchesField handles: *, */n, n/step, a-b, a,b,c, and specific values.
// Kept in sync with Landing.jsx, if one is updated, update the other.

function matchesField(value, n, min) {
  if (value === "*") return true;
  if (value.startsWith("*/")) return (n - min) % parseInt(value.slice(2)) === 0;
  if (value.includes("/")) {
    const [range, step] = value.split("/");
    const start = range === "*" ? min : parseInt(range.split("-")[0]);
    return n >= start && (n - start) % parseInt(step) === 0;
  }
  if (value.includes("-")) { const [a,b]=value.split("-"); return n>=parseInt(a)&&n<=parseInt(b); }
  if (value.includes(",")) return value.split(",").map(Number).includes(n);
  return parseInt(value) === n;
}

function getNextRun(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minF,hourF,domF,monF,dowF] = parts;
  const d = new Date(); d.setSeconds(0,0); d.setMinutes(d.getMinutes()+1);
  let i = 0;
  while (i++ < 200000) {
    if (!matchesField(monF,d.getMonth()+1,1)) { d.setMonth(d.getMonth()+1); d.setDate(1); d.setHours(0,0,0,0); continue; }
    const dOk=matchesField(domF,d.getDate(),1), wOk=matchesField(dowF,d.getDay(),0);
    const dayOk=domF==="*"&&dowF==="*"?true:domF!=="*"&&dowF!=="*"?(dOk||wOk):domF!=="*"?dOk:wOk;
    if (!dayOk) { d.setDate(d.getDate()+1); d.setHours(0,0,0,0); continue; }
    if (!matchesField(hourF,d.getHours(),0)) { d.setHours(d.getHours()+1,0,0,0); continue; }
    if (!matchesField(minF,d.getMinutes(),0)) { d.setMinutes(d.getMinutes()+1,0,0); continue; }
    return d;
  }
  return null;
}

function fmt(date) {
  if (!date) return "—";
  const DN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const MN=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h=date.getHours(), m=String(date.getMinutes()).padStart(2,"0");
  return `${DN[date.getDay()]}, ${MN[date.getMonth()]} ${date.getDate()} at ${h%12||12}:${m} ${h>=12?"PM":"AM"}`;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const EXAMPLES = [
  { expr:"0 9 * * 1-5",  label:"Weekday 9am"  },
  { expr:"0 0 1 * *",    label:"Monthly reset" },
  { expr:"0 */6 * * *",  label:"Every 6 hours" },
  { expr:"30 18 * * 5",  label:"Fri 6:30pm"    },
  { expr:"0 0 * * 0",    label:"Weekly Sunday" },
  { expr:"*/30 * * * *", label:"Every 30 min"  },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function Scheduler() {
  const { C } = useTheme();

  // Create-alert form state
  const [cron,       setCron]       = useState("0 9 * * 1-5");
  const [email,      setEmail]      = useState("");
  const [name,       setName]       = useState("");
  const [notify,     setNotify]     = useState(15);
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState(null);
  const [cronErr,    setCronErr]    = useState(null);
  const [nextRun,    setNextRun]    = useState(null);
  const [copiedToken,setCopiedToken]= useState(false);

  // My-alerts lookup state
  const [lookupEmail, setLookupEmail] = useState("");
  const [looking,     setLooking]     = useState(false);
  const [jobs,        setJobs]        = useState([]);
  const [lookedUp,    setLookedUp]    = useState(false);

  // Live cron preview
  useEffect(() => {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) { setCronErr("Needs exactly 5 fields: MIN HOUR DOM MON DOW"); setNextRun(null); }
    else { setCronErr(null); setNextRun(getNextRun(cron)); }
  }, [cron]);

  async function handleCreate(e) {
    e.preventDefault();
    if (cronErr || !email.trim() || !name.trim()) return;
    setLoading(true); setResult(null);
    try {
      const res  = await fetch("/api/schedule-job", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"create", cron:cron.trim(), email:email.trim(), name:name.trim(), notifyMinutes:notify }),
      });
      const data = await res.json();
      setResult(res.ok ? { success:true, ...data } : { success:false, error:data.error||"Something went wrong." });
    } catch { setResult({ success:false, error:"Network error. Check your connection." }); }
    finally { setLoading(false); }
  }

  async function handleLookup(e) {
    e.preventDefault();
    if (!lookupEmail.trim()) return;
    setLooking(true); setJobs([]); setLookedUp(false);
    try {
      const res  = await fetch("/api/schedule-job", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"list", email:lookupEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) setJobs(data.jobs || []);
    } catch {}
    finally { setLooking(false); setLookedUp(true); }
  }

  // FIX: previously removed job from UI even if server returned 403 (wrong token).
  // Now we only remove from UI when the server confirms deletion (res.ok).
  async function handleDelete(jobId, token) {
    if (!token.trim()) return;
    try {
      const res = await fetch("/api/schedule-job", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"delete", jobId, token }),
      });
      if (res.ok) {
        setJobs(j => j.filter(x => x.id !== jobId));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete. Check your token and try again.");
      }
    } catch { alert("Network error. Try again."); }
  }

  const s = makeStyles(C);

  return (
    <div style={s.root}>
      <style>{themeCSS(C)}{schedulerExtras(C)}</style>

      <ThemeNav links={[
        { href:"/",      label:"Home"  },
        { href:"/docs",  label:"Docs"  },
        { href:"/terms", label:"Terms" },
      ]} />

      <main style={s.main}>

        {/* Page header */}
        <div style={s.header}>
          <div style={s.badge}>SCHEDULER</div>
          <h1 style={s.title}>Cron Job Alerts</h1>
          <p style={s.subtitle}>Register any cron expression and get an email alert before it fires. Free, no account needed, just your email.</p>
        </div>

        {/* Two-column grid — stacks to single column on mobile via .sch-grid media query
            FIX: added className="sch-grid" so the CSS breakpoint in schedulerExtras actually fires */}
        <div style={s.grid} className="sch-grid">

          {/* ── CREATE ALERT ── */}
          <div style={s.card}>
            <h2 style={s.cardTitle}>⏰ Set up an alert</h2>

            <form onSubmit={handleCreate} style={s.form}>

              {/* Job name */}
              <div style={s.field}>
                <label style={s.label}>JOB NAME</label>
                <input style={s.input} placeholder="e.g. Daily report, DB backup"
                  value={name} onChange={e=>setName(e.target.value)} required className="sch-input" />
              </div>

              {/* Cron expression */}
              <div style={s.field}>
                <label style={s.label}>CRON EXPRESSION</label>
                <div style={{ ...s.cronWrap, ...(cronErr ? { borderColor:"#cc3333" } : {}) }}>
                  <span style={s.prompt}>$</span>
                  <input style={s.cronInput} value={cron} onChange={e=>setCron(e.target.value)}
                    placeholder="0 9 * * 1-5" spellCheck={false} className="sch-input" />
                </div>
                {cronErr
                  ? <div style={s.fieldErr}>{cronErr}</div>
                  : nextRun && <div style={s.fieldHint}>✓ Next run: <span style={{ color:C.green }}>{fmt(nextRun)}</span></div>
                }
                <div style={s.exGrid}>
                  {EXAMPLES.map((ex,i) => (
                    <button type="button" key={i} style={s.exBtn} onClick={()=>setCron(ex.expr)} className="ex-btn">
                      <span style={{ color:C.accent, fontSize:"11px" }}>{ex.expr}</span>
                      <span style={{ color:C.textMuted, fontSize:"9px", letterSpacing:"1px" }}>{ex.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Email */}
              <div style={s.field}>
                <label style={s.label}>YOUR EMAIL</label>
                <input style={s.input} type="email" placeholder="you@gmail.com"
                  value={email} onChange={e=>setEmail(e.target.value)} required className="sch-input" />
                <div style={s.fieldHint}>We'll send alerts here. No spam. Delete anytime with your token.</div>
              </div>

              {/* Alert timing */}
              <div style={s.field}>
                <label style={s.label}>ALERT ME BEFORE</label>
                <div style={s.segGroup}>
                  {[5,10,15,30,60].map(n=>(
                    <button type="button" key={n}
                      style={{ ...s.seg, ...(notify===n ? { background:C.accentDim, border:`1px solid ${C.accent}`, color:C.accent } : {}) }}
                      onClick={()=>setNotify(n)} className="seg-btn">
                      {n<60?`${n}m`:"1h"}
                    </button>
                  ))}
                </div>
              </div>

              {/* API error */}
              {result && !result.success && (
                <div style={s.errBox}>
                  <span style={s.errIcon}>!</span> {result.error}
                </div>
              )}

              <button type="submit"
                style={{ ...s.submitBtn, ...((!name||!email||cronErr||loading) ? s.submitOff : {}) }}
                disabled={!name||!email||!!cronErr||loading} className="submit-btn">
                {loading ? "Creating…" : "Create alert →"}
              </button>
            </form>

            {/* Success panel */}
            {result?.success && (
              <div style={s.successBox}>
                <div style={s.successCheck}>✓</div>
                <div>
                  <div style={s.successTitle}>Alert created!</div>
                  <p style={s.successSub}>
                    You'll get an email at <strong>{email}</strong> {notify} minutes before <span style={{ color:C.accent }}>{cron}</span> fires.
                  </p>
                  <div style={s.tokenCard}>
                    <div style={s.tokenLabel}>MANAGEMENT TOKEN — save this to delete the alert later</div>
                    <div style={s.tokenRow}>
                      <code style={s.tokenCode}>{result.token}</code>
                      <button
                        style={{ ...s.tokenCopy, ...(copiedToken ? { borderColor:C.accent, color:C.accent } : {}) }}
                        onClick={()=>{ navigator.clipboard.writeText(result.token); setCopiedToken(true); setTimeout(()=>setCopiedToken(false),2000); }}
                        className="copy-btn">
                        {copiedToken?"✓":"COPY"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── MY ALERTS ── */}
          <div style={s.card}>
            <h2 style={s.cardTitle}>📋 My alerts</h2>
            <p style={s.cardSub}>Look up and manage your active alerts by email.</p>

            <form onSubmit={handleLookup} style={s.lookupRow}>
              <input style={{ ...s.input, flex:1 }} type="email" placeholder="your@email.com"
                value={lookupEmail} onChange={e=>setLookupEmail(e.target.value)} className="sch-input" />
              <button type="submit"
                style={{ ...s.lookupBtn, ...(!lookupEmail||looking ? s.submitOff : {}) }}
                disabled={!lookupEmail||looking} className="submit-btn">
                {looking ? "…" : "Look up"}
              </button>
            </form>

            {lookedUp && jobs.length === 0 && (
              <div style={s.emptyState}>No active alerts found for this email.</div>
            )}

            {jobs.map(job => (
              <JobCard key={job.id} job={job} C={C} s={s} onDelete={handleDelete} />
            ))}

            {/* How it works */}
            <div style={s.howBox}>
              <div style={s.howLabel}>HOW IT WORKS</div>
              {[
                "Register your cron expression + email above",
                "Our checker runs every 10 minutes",
                "You get an email alert before each scheduled run",
                "Delete your alert anytime using your token",
              ].map((step,i) => (
                <div key={i} style={s.howRow}>
                  <span style={s.howNum}>{String(i+1).padStart(2,"0")}</span>
                  <span style={s.howText}>{step}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      <footer style={s.footer}>
        <span style={{ fontWeight:700, color:C.text }}>CRON<span style={{ color:C.accent }}>.EXPLAIN</span></span>
        <div style={{ display:"flex", gap:"16px", flexWrap:"wrap" }}>
          {[["Home","/"],["Docs","/docs"],["Terms","/terms"]].map(([l,h])=>(
            <a key={h} href={h} style={{ color:C.textSub, textDecoration:"none", fontSize:"12px" }} className="tnav-link">{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}

// ─── JOB CARD ─────────────────────────────────────────────────────────────────

function JobCard({ job, C, s, onDelete }) {
  const [token,      setToken]      = useState("");
  const [confirming, setConfirming] = useState(false);
  const nr = job.nextRun ? new Date(job.nextRun) : null;

  return (
    <div style={s.jobCard}>
      <div style={s.jobTop}>
        <div>
          <div style={s.jobName}>{job.name}</div>
          <div style={s.jobCron}>{job.cron}</div>
        </div>
        <span style={s.jobBadge}>{job.notifyMinutes}m before</span>
      </div>
      {nr && (
        <div style={{ fontSize:"12px", color:C.textMuted, marginBottom:"10px" }}>
          Next: <span style={{ color:C.green }}>{fmt(nr)}</span>
        </div>
      )}
      {!confirming
        ? <button style={s.deleteBtn} onClick={()=>setConfirming(true)} className="delete-btn">Delete</button>
        : (
          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
            <input
              style={{ ...s.input, flex:1, minWidth:"140px", fontSize:"11px", padding:"7px 12px" }}
              placeholder="Paste management token"
              value={token} onChange={e=>setToken(e.target.value)} className="sch-input" />
            <button
              style={{ ...s.deleteBtn, borderColor:"#cc3333", color:"#cc5555" }}
              onClick={()=>{ if(token) { onDelete(job.id, token); setConfirming(false); } }}
              className="delete-btn">Confirm</button>
            <button
              style={{ ...s.deleteBtn, borderColor:C.border2, color:C.textSub }}
              onClick={()=>{ setConfirming(false); setToken(""); }}>Cancel</button>
          </div>
        )
      }
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

function makeStyles(C) {
  return {
    root:     { background:C.bg, minHeight:"100vh", color:C.text, fontFamily:"'IBM Plex Mono',monospace", transition:"background 0.2s, color 0.2s" },
    main:     { maxWidth:"1060px", margin:"0 auto", padding:"clamp(28px,5vw,52px) clamp(16px,4vw,28px) 80px" },
    header:   { textAlign:"center", marginBottom:"clamp(28px,4vw,48px)" },
    badge:    { display:"inline-block", background:C.accentDim, border:`1px solid ${C.accent}33`, borderRadius:"2px", padding:"4px 12px", fontSize:"9px", letterSpacing:"3px", color:C.accent, marginBottom:"14px" },
    title:    { fontSize:"clamp(26px,5vw,44px)", fontWeight:"800", color:C.text, margin:"0 0 14px", letterSpacing:"-1.5px", fontFamily:"'DM Serif Display',Georgia,serif" },
    subtitle: { fontSize:"clamp(13px,2vw,15px)", color:C.textSub, lineHeight:"1.85", maxWidth:"500px", margin:"0 auto" },

    // grid inline style — className="sch-grid" is on the div so the media query in schedulerExtras fires
    grid:     { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px", alignItems:"start" },

    card:     { background:C.card, border:`1px solid ${C.border}`, borderRadius:"8px", padding:"clamp(20px,4vw,28px)", display:"flex", flexDirection:"column", gap:"18px" },
    cardTitle:{ fontSize:"16px", fontWeight:"700", color:C.text, margin:0 },
    cardSub:  { fontSize:"13px", color:C.textMuted, margin:"-10px 0 0", lineHeight:"1.7" },

    form:     { display:"flex", flexDirection:"column", gap:"18px" },
    field:    { display:"flex", flexDirection:"column", gap:"7px" },
    label:    { fontSize:"9px", letterSpacing:"3px", color:C.textMuted },
    input:    { background:C.inputBg, border:`1px solid ${C.border2}`, borderRadius:"4px", padding:"10px 14px", color:C.text, fontSize:"13px", fontFamily:"inherit", outline:"none", transition:"border-color 0.2s", width:"100%", boxSizing:"border-box" },
    cronWrap: { display:"flex", alignItems:"center", gap:"10px", background:C.inputBg, border:`1.5px solid ${C.border2}`, borderRadius:"4px", padding:"10px 14px", transition:"border-color 0.2s" },
    prompt:   { color:C.accent, fontSize:"16px", fontWeight:"bold", flexShrink:0 },
    cronInput:{ background:"transparent", border:"none", outline:"none", color:C.text, fontSize:"15px", fontFamily:"inherit", letterSpacing:"4px", width:"100%", caretColor:C.accent },
    fieldErr: { fontSize:"11px", color:"#cc5555" },
    fieldHint:{ fontSize:"11px", color:C.textMuted, lineHeight:"1.6" },

    exGrid:   { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:"4px" },
    exBtn:    { background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:"3px", padding:"8px 10px", cursor:"pointer", textAlign:"left", display:"flex", flexDirection:"column", gap:"2px", fontFamily:"inherit", transition:"border-color 0.15s" },

    segGroup: { display:"flex", gap:"6px", flexWrap:"wrap" },
    seg:      { background:C.inputBg, border:`1px solid ${C.border2}`, color:C.textSub, fontFamily:"inherit", fontSize:"11px", letterSpacing:"1px", padding:"7px 14px", cursor:"pointer", borderRadius:"3px", transition:"all 0.15s" },

    submitBtn:{ background:C.accent, color:C.accentText, border:"none", padding:"13px 22px", fontSize:"12px", letterSpacing:"2px", fontFamily:"inherit", fontWeight:"700", cursor:"pointer", borderRadius:"3px", transition:"all 0.2s", width:"100%" },
    submitOff:{ background:C.border, color:C.textMuted, cursor:"not-allowed" },

    errBox:   { background:C.card2, border:`1px solid ${C.border}`, borderLeft:"3px solid #cc3333", borderRadius:"4px", padding:"12px 16px", color:"#cc5555", fontSize:"13px", display:"flex", gap:"10px", alignItems:"center" },
    errIcon:  { border:"1px solid #cc3333", borderRadius:"50%", width:"18px", height:"18px", textAlign:"center", lineHeight:"18px", fontSize:"11px", flexShrink:0 },

    successBox:  { background:C.greenBg, border:`1px solid ${C.greenDim}`, borderLeft:`3px solid ${C.green}`, borderRadius:"6px", padding:"18px", display:"flex", gap:"14px" },
    successCheck:{ color:C.green, fontSize:"22px", flexShrink:0 },
    successTitle:{ fontSize:"15px", fontWeight:"700", color:C.green, marginBottom:"6px" },
    successSub:  { fontSize:"13px", color:C.textSub, lineHeight:"1.7", margin:"0 0 14px" },
    tokenCard:   { background:C.card, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"12px" },
    tokenLabel:  { fontSize:"9px", letterSpacing:"2px", color:C.textMuted, marginBottom:"8px" },
    tokenRow:    { display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" },
    tokenCode:   { color:C.accent, fontSize:"11px", flex:1, wordBreak:"break-all", letterSpacing:"0.5px", minWidth:"120px" },
    tokenCopy:   { background:"transparent", border:`1px solid ${C.border2}`, color:C.textMuted, fontFamily:"inherit", fontSize:"10px", letterSpacing:"2px", padding:"4px 10px", cursor:"pointer", borderRadius:"2px", transition:"all 0.2s", flexShrink:0 },

    lookupRow: { display:"flex", gap:"8px", flexWrap:"wrap" },
    lookupBtn: { background:C.card2, border:`1px solid ${C.border2}`, color:C.text, fontFamily:"inherit", fontSize:"12px", letterSpacing:"1px", padding:"10px 16px", cursor:"pointer", borderRadius:"3px", flexShrink:0, fontWeight:"600", transition:"all 0.2s" },
    emptyState:{ fontSize:"13px", color:C.textMuted, textAlign:"center", padding:"24px 0", lineHeight:"1.8" },

    jobCard: { background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:"5px", padding:"14px", marginBottom:"8px" },
    jobTop:  { display:"flex", justifyContent:"space-between", gap:"12px", marginBottom:"8px", flexWrap:"wrap" },
    jobName: { fontSize:"14px", fontWeight:"700", color:C.text, marginBottom:"3px" },
    jobCron: { fontSize:"12px", color:C.accent, letterSpacing:"1px" },
    jobBadge:{ fontSize:"10px", color:C.green, border:`1px solid ${C.greenDim}`, background:C.greenBg, borderRadius:"2px", padding:"3px 8px", letterSpacing:"1px", flexShrink:0 },
    deleteBtn:{ background:"transparent", border:`1px solid ${C.border2}`, color:C.textMuted, fontFamily:"inherit", fontSize:"11px", padding:"6px 14px", cursor:"pointer", borderRadius:"3px", transition:"all 0.2s" },

    howBox:  { background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:"5px", padding:"18px" },
    howLabel:{ fontSize:"9px", letterSpacing:"3px", color:C.textMuted, marginBottom:"14px" },
    howRow:  { display:"flex", gap:"12px", padding:"8px 0", borderBottom:`1px solid ${C.border}`, alignItems:"flex-start" },
    howNum:  { fontSize:"10px", color:C.accent, fontWeight:"700", flexShrink:0, marginTop:"2px", width:"20px" },
    howText: { fontSize:"12px", color:C.textSub, lineHeight:"1.7" },

    footer:  { borderTop:`1px solid ${C.border}`, padding:"22px clamp(16px,4vw,32px)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px", fontFamily:"'IBM Plex Mono',monospace" },
  };
}

function schedulerExtras(C) {
  return `
    .sch-input:focus         { border-color: ${C.accent} !important; outline: none; }
    .ex-btn:hover            { border-color: ${C.accent} !important; }
    .seg-btn:hover           { border-color: ${C.accent} !important; color: ${C.accent} !important; }
    .submit-btn:not(:disabled):hover { opacity: 0.85; transform: translateY(-1px); }
    .delete-btn:hover        { border-color: #cc3333 !important; color: #cc5555 !important; }
    .copy-btn:hover          { border-color: ${C.accent} !important; color: ${C.accent} !important; }

    /* Stack grid to single column on tablet/mobile */
    @media (max-width: 760px) {
      .sch-grid { grid-template-columns: 1fr !important; }
    }
    @media (max-width: 500px) {
      main { padding: 20px 14px 60px !important; }
    }
  `;
}
