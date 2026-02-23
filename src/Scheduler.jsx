import { useState, useEffect } from "react";

// ─── CRON NEXT-RUN (client-side preview) ─────────────────────────────────────

function matchesField(value, n, min) {
  if (value === "*") return true;
  if (value.startsWith("*/")) return (n - min) % parseInt(value.slice(2)) === 0;
  if (value.includes("-")) { const [a,b]=value.split("-"); return n>=parseInt(a)&&n<=parseInt(b); }
  if (value.includes(",")) return value.split(",").map(Number).includes(n);
  return parseInt(value) === n;
}

function getNextRun(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minF, hourF, domF, monF, dowF] = parts;
  const d = new Date(); d.setSeconds(0,0); d.setMinutes(d.getMinutes()+1);
  let i = 0;
  while (i++ < 100000) {
    const mon=d.getMonth()+1, dom=d.getDate(), dow=d.getDay(), hour=d.getHours(), min=d.getMinutes();
    if (!matchesField(monF,mon,1)) { d.setMonth(d.getMonth()+1); d.setDate(1); d.setHours(0,0,0,0); continue; }
    const domOk=matchesField(domF,dom,1), dowOk=matchesField(dowF,dow,0);
    const dayOk=domF==="*"&&dowF==="*"?true:domF!=="*"&&dowF!=="*"?(domOk||dowOk):domF!=="*"?domOk:dowOk;
    if (!dayOk) { d.setDate(d.getDate()+1); d.setHours(0,0,0,0); continue; }
    if (!matchesField(hourF,hour,0)) { d.setHours(d.getHours()+1,0,0,0); continue; }
    if (!matchesField(minF,min,0)) { d.setMinutes(d.getMinutes()+1,0,0); continue; }
    return d;
  }
  return null;
}

function formatDateTime(date) {
  if (!date) return "—";
  const DN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const MN=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h=date.getHours(), m=String(date.getMinutes()).padStart(2,"0");
  const ampm=h>=12?"PM":"AM", h12=h%12===0?12:h%12;
  return `${DN[date.getDay()]}, ${MN[date.getMonth()]} ${date.getDate()} at ${h12}:${m} ${ampm}`;
}

// ─── EXAMPLES ────────────────────────────────────────────────────────────────

const EXAMPLES = [
  { expr:"0 9 * * 1-5",  label:"Weekday 9am" },
  { expr:"0 0 1 * *",    label:"Monthly reset" },
  { expr:"0 */6 * * *",  label:"Every 6 hours" },
  { expr:"30 18 * * 5",  label:"Friday 6:30pm" },
  { expr:"0 0 * * 0",    label:"Weekly Sunday" },
  { expr:"*/30 * * * *", label:"Every 30 mins" },
];

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function Scheduler() {
  const [cron,    setCron]    = useState("0 9 * * 1-5");
  const [email,   setEmail]   = useState("");
  const [name,    setName]    = useState("");
  const [notify,  setNotify]  = useState(15);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null); // { success, jobId, token, error }
  const [myJobs,  setMyJobs]  = useState([]);
  const [lookup,  setLookup]  = useState("");
  const [looking, setLooking] = useState(false);
  const [cronErr, setCronErr] = useState(null);
  const [nextRun, setNextRun] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Live cron preview
  useEffect(() => {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) {
      setCronErr("Needs exactly 5 fields: MIN HOUR DOM MON DOW");
      setNextRun(null);
    } else {
      setCronErr(null);
      setNextRun(getNextRun(cron));
    }
  }, [cron]);

  async function handleCreate(e) {
    e.preventDefault();
    if (cronErr || !email.trim() || !name.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/schedule-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          cron: cron.trim(),
          email: email.trim(),
          name: name.trim(),
          notifyMinutes: Number(notify),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, ...data });
      } else {
        setResult({ success: false, error: data.error || "Something went wrong." });
      }
    } catch (err) {
      setResult({ success: false, error: "Network error. Try again." });
    } finally {
      setLoading(false);
    }
  }

  async function handleLookup(e) {
    e.preventDefault();
    if (!lookup.trim()) return;
    setLooking(true);
    setMyJobs([]);
    try {
      const res = await fetch("/api/schedule-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", email: lookup.trim() }),
      });
      const data = await res.json();
      if (res.ok) setMyJobs(data.jobs || []);
    } catch {}
    finally { setLooking(false); }
  }

  async function handleDelete(jobId, token) {
    try {
      await fetch("/api/schedule-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", jobId, token }),
      });
      setMyJobs(j => j.filter(x => x.id !== jobId));
    } catch {}
  }

  return (
    <div style={S.root}>
      <style>{css}</style>

      {/* Nav */}
      <nav style={S.nav}>
        <a href="/" style={S.navLogo}>CRON<span style={S.accent}>.EXPLAIN</span></a>
        <div style={S.navRight}>
          <a href="/" style={S.navLink} className="nav-link">Home</a>
          <a href="/docs" style={S.navLink} className="nav-link">Docs</a>
          <a href="/terms" style={S.navLink} className="nav-link">Terms</a>
        </div>
      </nav>

      <main style={S.main}>

        {/* Header */}
        <div style={S.header}>
          <div style={S.badge}>NEW FEATURE</div>
          <h1 style={S.title}>Cron Job Scheduler</h1>
          <p style={S.subtitle}>
            Register any cron expression and receive an email alert before it fires.
            Free. No account required — just your email address.
          </p>
        </div>

        <div style={S.columns}>

          {/* ── CREATE FORM ── */}
          <div style={S.card}>
            <h2 style={S.cardTitle}>⏰ Set up an alert</h2>
            <form onSubmit={handleCreate} style={S.form}>

              <div style={S.field}>
                <label style={S.label}>JOB NAME</label>
                <input
                  style={S.input}
                  placeholder="e.g. Daily report, Database backup"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="sch-input"
                />
              </div>

              <div style={S.field}>
                <label style={S.label}>CRON EXPRESSION</label>
                <div style={S.cronInputWrap}>
                  <span style={S.cronPrompt}>$</span>
                  <input
                    style={{...S.input, ...S.cronInput, ...(cronErr ? S.inputErr : {})}}
                    value={cron}
                    onChange={e => setCron(e.target.value)}
                    placeholder="0 9 * * 1-5"
                    spellCheck={false}
                    className="sch-input"
                  />
                </div>
                {cronErr && <div style={S.fieldErr}>{cronErr}</div>}
                {!cronErr && nextRun && (
                  <div style={S.fieldHint}>
                    ✓ Next run: <span style={{ color: "#4caf50" }}>{formatDateTime(nextRun)}</span>
                  </div>
                )}
                <div style={S.exampleGrid}>
                  {EXAMPLES.map((ex,i) => (
                    <button type="button" key={i} style={S.exBtn} onClick={() => setCron(ex.expr)} className="ex-btn">
                      <span style={S.exExpr}>{ex.expr}</span>
                      <span style={S.exLabel}>{ex.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={S.field}>
                <label style={S.label}>YOUR EMAIL</label>
                <input
                  style={S.input}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="sch-input"
                />
                <div style={S.fieldHint}>We'll send alerts here. No spam. Unsubscribe any time by deleting the job.</div>
              </div>

              <div style={S.field}>
                <label style={S.label}>NOTIFY ME</label>
                <div style={S.segGroup}>
                  {[5, 10, 15, 30, 60].map(n => (
                    <button type="button" key={n}
                      style={{...S.seg, ...(notify===n ? S.segOn : {})}}
                      onClick={() => setNotify(n)}
                      className={`seg ${notify===n?"seg-on":""}`}
                    >
                      {n < 60 ? `${n}m before` : "1h before"}
                    </button>
                  ))}
                </div>
              </div>

              {result && !result.success && (
                <div style={S.errorBox}>
                  <span style={S.errorIcon}>!</span>{result.error}
                </div>
              )}

              <button
                type="submit"
                style={{...S.submitBtn, ...(!name.trim()||!email.trim()||cronErr||loading ? S.submitBtnOff : {})}}
                disabled={!name.trim()||!email.trim()||!!cronErr||loading}
                className="submit-btn"
              >
                {loading ? "Creating..." : "Create alert →"}
              </button>
            </form>

            {/* Success state */}
            {result?.success && (
              <div style={S.successCard}>
                <div style={S.successIcon}>✓</div>
                <div>
                  <div style={S.successTitle}>Alert created!</div>
                  <div style={S.successSub}>
                    You'll receive an email at <strong>{email}</strong> {notify} minutes before each run of{" "}
                    <span style={{ color: "#f0c040" }}>{cron}</span>.
                  </div>
                  <div style={S.tokenBox}>
                    <div style={S.tokenLabel}>MANAGEMENT TOKEN — save this to delete your job later</div>
                    <div style={S.tokenRow}>
                      <code style={S.tokenCode}>{result.token}</code>
                      <button style={{...S.tokenCopy, ...(copiedToken?S.tokenCopied:{})}}
                        onClick={() => { navigator.clipboard.writeText(result.token); setCopiedToken(true); setTimeout(()=>setCopiedToken(false),2000); }}
                        className="token-copy">
                        {copiedToken ? "✓" : "COPY"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── MY JOBS ── */}
          <div style={S.card}>
            <h2 style={S.cardTitle}>📋 My alerts</h2>
            <p style={S.cardSub}>Enter your email to see and manage your active alerts.</p>
            <form onSubmit={handleLookup} style={{ display:"flex", gap:"8px", marginBottom:"20px" }}>
              <input
                style={{...S.input, flex:1}}
                type="email"
                placeholder="you@example.com"
                value={lookup}
                onChange={e => setLookup(e.target.value)}
                className="sch-input"
              />
              <button type="submit"
                style={{...S.lookupBtn, ...(!lookup.trim()||looking ? S.submitBtnOff : {})}}
                disabled={!lookup.trim()||looking}
                className="submit-btn"
              >
                {looking ? "..." : "Look up"}
              </button>
            </form>

            {myJobs.length === 0 && !looking && (
              <div style={S.emptyState}>No active alerts found for this email.</div>
            )}

            {myJobs.map(job => (
              <div key={job.id} style={S.jobCard} className="job-card">
                <div style={S.jobTop}>
                  <div>
                    <div style={S.jobName}>{job.name}</div>
                    <div style={S.jobCron}>{job.cron}</div>
                  </div>
                  <div style={S.jobMeta}>
                    <span style={S.jobNotify}>{job.notifyMinutes}m before</span>
                  </div>
                </div>
                {job.nextRun && (
                  <div style={S.jobNextRun}>
                    Next: <span style={{ color:"#4caf50" }}>{formatDateTime(new Date(job.nextRun))}</span>
                  </div>
                )}
                <div style={S.jobActions}>
                  <input
                    style={S.tokenInputSmall}
                    placeholder="Paste token to delete"
                    id={`token-${job.id}`}
                    className="sch-input"
                  />
                  <button
                    style={S.deleteBtn}
                    onClick={() => {
                      const t = document.getElementById(`token-${job.id}`).value;
                      if (t) handleDelete(job.id, t);
                    }}
                    className="delete-btn"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {/* How it works */}
            <div style={S.howBox}>
              <div style={S.howTitle}>HOW IT WORKS</div>
              {[
                "Register your cron expression and email above",
                "We check every 10 minutes for upcoming runs",
                "You get an email alert before each scheduled run",
                "Delete your alert any time using the management token",
              ].map((s,i) => (
                <div key={i} style={S.howStep}>
                  <span style={S.howNum}>{String(i+1).padStart(2,"0")}</span>
                  <span style={S.howText}>{s}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      <footer style={S.footer}>
        <div style={S.footerInner}>
          <span>CRON<span style={S.accent}>.EXPLAIN</span></span>
          <div style={{ display:"flex", gap:"16px" }}>
            <a href="/" style={S.footerLink} className="nav-link">Home</a>
            <a href="/docs" style={S.footerLink} className="nav-link">Docs</a>
            <a href="/terms" style={S.footerLink} className="nav-link">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const A = "#f0c040"; // accent

const S = {
  root: { background:"#0a0a0a", minHeight:"100vh", fontFamily:"'IBM Plex Mono','Courier New',monospace", color:"#e0e0e0" },
  nav: { position:"sticky", top:0, zIndex:100, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0 32px", height:"61px", background:"rgba(10,10,10,0.97)", borderBottom:"1px solid #141414", backdropFilter:"blur(8px)" },
  navLogo: { fontSize:"16px", fontWeight:"800", color:"#fff", textDecoration:"none" },
  accent: { color: A },
  navRight: { display:"flex", gap:"20px", alignItems:"center" },
  navLink: { color:"#555", textDecoration:"none", fontSize:"12px", letterSpacing:"1px", transition:"color 0.2s" },

  main: { maxWidth:"1100px", margin:"0 auto", padding:"48px 24px 80px" },
  header: { textAlign:"center", marginBottom:"48px" },
  badge: { display:"inline-block", background:"#1a1500", border:`1px solid ${A}22`, borderRadius:"2px", padding:"4px 12px", fontSize:"9px", letterSpacing:"3px", color:A, marginBottom:"16px" },
  title: { fontSize:"clamp(28px,5vw,48px)", fontWeight:"800", color:"#fff", margin:"0 0 16px 0", letterSpacing:"-1.5px", fontFamily:"'DM Serif Display','Georgia',serif" },
  subtitle: { fontSize:"14px", color:"#666", lineHeight:"1.8", maxWidth:"520px", margin:"0 auto" },

  columns: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"24px", alignItems:"start" },

  card: { background:"#0f0f0f", border:"1px solid #1a1a1a", borderRadius:"8px", padding:"28px", display:"flex", flexDirection:"column", gap:"20px" },
  cardTitle: { fontSize:"16px", fontWeight:"700", color:"#fff", margin:0, letterSpacing:"-0.5px" },
  cardSub: { fontSize:"13px", color:"#555", margin:"-12px 0 0 0", lineHeight:"1.7" },

  form: { display:"flex", flexDirection:"column", gap:"20px" },
  field: { display:"flex", flexDirection:"column", gap:"8px" },
  label: { fontSize:"9px", letterSpacing:"3px", color:"#444" },
  input: { background:"#141414", border:"1px solid #1e1e1e", borderRadius:"4px", padding:"10px 14px", color:"#e0e0e0", fontSize:"13px", fontFamily:"inherit", outline:"none", transition:"border-color 0.2s", width:"100%", boxSizing:"border-box" },
  inputErr: { borderColor:"#cc3333" },
  cronInputWrap: { display:"flex", alignItems:"center", gap:"10px", background:"#141414", border:"1px solid #1e1e1e", borderRadius:"4px", padding:"10px 14px" },
  cronPrompt: { color: A, fontWeight:"bold", fontSize:"16px", flexShrink:0 },
  cronInput: { background:"transparent", border:"none", padding:0, letterSpacing:"4px", fontSize:"15px" },
  fieldErr: { fontSize:"11px", color:"#cc5555" },
  fieldHint: { fontSize:"11px", color:"#444", lineHeight:"1.6" },

  exampleGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:"4px" },
  exBtn: { background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:"3px", padding:"8px 10px", cursor:"pointer", textAlign:"left", display:"flex", flexDirection:"column", gap:"2px", fontFamily:"inherit", transition:"border-color 0.15s" },
  exExpr: { color: A, fontSize:"11px" },
  exLabel: { color:"#444", fontSize:"9px", letterSpacing:"1px" },

  segGroup: { display:"flex", gap:"6px", flexWrap:"wrap" },
  seg: { background:"#0a0a0a", border:"1px solid #1a1a1a", color:"#555", fontFamily:"inherit", fontSize:"11px", padding:"7px 12px", cursor:"pointer", borderRadius:"3px", transition:"all 0.15s" },
  segOn: { background:"#1a1500", border:`1px solid ${A}`, color: A },

  submitBtn: { background: A, color:"#000", border:"none", padding:"13px 24px", fontSize:"12px", letterSpacing:"2px", fontFamily:"inherit", fontWeight:"700", cursor:"pointer", borderRadius:"3px", transition:"all 0.2s" },
  submitBtnOff: { background:"#1a1a1a", color:"#333", cursor:"not-allowed" },
  lookupBtn: { background:"#1a1a1a", color:"#aaa", border:"1px solid #2a2a2a", padding:"10px 16px", fontSize:"11px", letterSpacing:"1px", fontFamily:"inherit", fontWeight:"700", cursor:"pointer", borderRadius:"3px", flexShrink:0, transition:"all 0.2s" },

  errorBox: { background:"#120808", border:"1px solid #3a1010", borderLeft:"3px solid #cc3333", borderRadius:"4px", padding:"12px 16px", color:"#cc5555", fontSize:"13px", display:"flex", gap:"10px", alignItems:"center" },
  errorIcon: { border:"1px solid #cc3333", borderRadius:"50%", width:"18px", height:"18px", textAlign:"center", lineHeight:"18px", fontSize:"11px", flexShrink:0 },

  successCard: { background:"#080e08", border:"1px solid #1a2a1a", borderLeft:"3px solid #4caf50", borderRadius:"4px", padding:"20px", display:"flex", gap:"16px", alignItems:"flex-start" },
  successIcon: { color:"#4caf50", fontSize:"22px", flexShrink:0 },
  successTitle: { fontSize:"15px", fontWeight:"700", color:"#4caf50", marginBottom:"6px" },
  successSub: { fontSize:"13px", color:"#666", lineHeight:"1.7", marginBottom:"14px" },
  tokenBox: { background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:"3px", padding:"14px" },
  tokenLabel: { fontSize:"9px", letterSpacing:"2px", color:"#333", marginBottom:"10px" },
  tokenRow: { display:"flex", gap:"10px", alignItems:"center" },
  tokenCode: { color: A, fontSize:"11px", flex:1, wordBreak:"break-all", letterSpacing:"0.5px" },
  tokenCopy: { background:"transparent", border:"1px solid #2a2a2a", color:"#444", fontFamily:"inherit", fontSize:"10px", letterSpacing:"2px", padding:"4px 10px", cursor:"pointer", borderRadius:"2px", flexShrink:0, transition:"all 0.2s" },
  tokenCopied: { borderColor: A, color: A },

  emptyState: { fontSize:"13px", color:"#333", textAlign:"center", padding:"24px 0", lineHeight:"1.8" },

  jobCard: { background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:"4px", padding:"16px", marginBottom:"8px" },
  jobTop: { display:"flex", justifyContent:"space-between", gap:"12px", marginBottom:"8px" },
  jobName: { fontSize:"14px", fontWeight:"700", color:"#fff", marginBottom:"4px" },
  jobCron: { fontSize:"12px", color: A, letterSpacing:"1px" },
  jobMeta: { flexShrink:0 },
  jobNotify: { fontSize:"10px", color:"#4caf50", border:"1px solid #1a2a1a", background:"#080e08", borderRadius:"2px", padding:"3px 8px", letterSpacing:"1px" },
  jobNextRun: { fontSize:"12px", color:"#444", marginBottom:"10px" },
  jobActions: { display:"flex", gap:"8px" },
  tokenInputSmall: { background:"#141414", border:"1px solid #1e1e1e", borderRadius:"3px", padding:"7px 12px", color:"#aaa", fontSize:"11px", fontFamily:"inherit", outline:"none", flex:1, minWidth:0 },
  deleteBtn: { background:"transparent", border:"1px solid #3a1010", color:"#cc5555", fontFamily:"inherit", fontSize:"11px", padding:"7px 14px", cursor:"pointer", borderRadius:"3px", flexShrink:0, transition:"all 0.2s" },

  howBox: { background:"#060606", border:"1px solid #141414", borderRadius:"4px", padding:"20px" },
  howTitle: { fontSize:"9px", letterSpacing:"3px", color:"#333", marginBottom:"16px" },
  howStep: { display:"flex", gap:"14px", alignItems:"flex-start", padding:"8px 0", borderBottom:"1px solid #0f0f0f" },
  howNum: { fontSize:"10px", color: A, fontWeight:"700", flexShrink:0, marginTop:"2px" },
  howText: { fontSize:"12px", color:"#555", lineHeight:"1.7" },

  footer: { borderTop:"1px solid #111", padding:"24px 32px" },
  footerInner: { maxWidth:"1100px", margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px" },
  footerLink: { color:"#444", textDecoration:"none", fontSize:"12px", letterSpacing:"1px", transition:"color 0.2s" },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700;800&family=DM+Serif+Display:ital@0;1&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: #0a0a0a; }

  .nav-link:hover  { color: ${A} !important; }
  .sch-input:focus { border-color: ${A} !important; outline: none; }
  .ex-btn:hover    { border-color: ${A} !important; }
  .seg:hover       { border-color: ${A} !important; color: ${A} !important; }
  .seg-on          { pointer-events: none; }
  .submit-btn:not(:disabled):hover { opacity: 0.85; transform: translateY(-1px); }
  .delete-btn:hover { background: #120808 !important; }
  .token-copy:hover { border-color: ${A} !important; color: ${A} !important; }
  .job-card:hover  { border-color: #2a2a2a !important; }

  @media (max-width: 780px) {
    .columns { grid-template-columns: 1fr !important; }
  }
  @media (max-width: 500px) {
    main { padding: 24px 16px 60px !important; }
    h1   { font-size: 26px !important; }
    nav  { padding: 0 16px !important; }
  }
`;
