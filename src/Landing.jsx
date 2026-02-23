import { useState, useEffect, useRef } from "react";

// ─── THEME TOKENS ─────────────────────────────────────────────────────────────

const DARK = {
  bg:          "#0a0a0a",
  bg2:         "#060606",
  card:        "#0f0f0f",
  card2:       "#111",
  border:      "#1a1a1a",
  border2:     "#2a2a2a",
  text:        "#e0e0e0",
  textSub:     "#666",
  textMuted:   "#444",
  textFaint:   "#333",
  accent:      "#f0c040",
  accentHover: "#ffd85c",
  accentDim:   "#f0c04025",
  green:       "#4caf50",
  greenDim:    "#1a5c1a",
  previewBg:   "#111",
  inputBg:     "#0d0d0d",
  promptColor: "#f0c040",
  navBg:       "rgba(10,10,10,0.95)",
  heroSub:     "#666",
  toggleBg:    "#1a1a1a",
  toggleIcon:  "☀️",
  toggleLabel: "Light mode",
};

const LIGHT = {
  bg:          "#f8f7f2",
  bg2:         "#f0ede4",
  card:        "#ffffff",
  card2:       "#fafaf7",
  border:      "#e0ddd4",
  border2:     "#ccc9be",
  text:        "#0a0a0a",
  textSub:     "#555",
  textMuted:   "#888",
  textFaint:   "#bbb",
  accent:      "#b8860b",
  accentHover: "#9a7010",
  accentDim:   "#b8860b18",
  green:       "#2a7a2a",
  greenDim:    "#c8e6c8",
  previewBg:   "#ffffff",
  inputBg:     "#fafaf7",
  promptColor: "#b8860b",
  navBg:       "rgba(248,247,242,0.97)",
  heroSub:     "#666",
  toggleBg:    "#e8e4d8",
  toggleIcon:  "🌙",
  toggleLabel: "Dark mode",
};

// ─── CRON NEXT-RUN ENGINE ────────────────────────────────────────────────────

function matchesField(value, n, min) {
  if (value === "*") return true;
  if (value.startsWith("*/")) return (n - min) % parseInt(value.slice(2)) === 0;
  if (value.includes("/")) {
    const [range, step] = value.split("/");
    const start = range === "*" ? min : parseInt(range.split("-")[0]);
    return n >= start && (n - start) % parseInt(step) === 0;
  }
  if (value.includes("-")) {
    const [a, b] = value.split("-");
    return n >= parseInt(a) && n <= parseInt(b);
  }
  if (value.includes(",")) return value.split(",").map(Number).includes(n);
  return parseInt(value) === n;
}

function getNextRuns(expr, count = 5) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return [];
  const [minF, hourF, domF, monF, dowF] = parts;
  const runs = [];
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  let iterations = 0;
  while (runs.length < count && iterations < 500000) {
    iterations++;
    const mon = d.getMonth() + 1, dom = d.getDate(), dow = d.getDay();
    const hour = d.getHours(), min = d.getMinutes();
    if (!matchesField(monF, mon, 1)) { d.setMonth(d.getMonth()+1); d.setDate(1); d.setHours(0,0,0,0); continue; }
    const domOk = matchesField(domF, dom, 1), dowOk = matchesField(dowF, dow, 0);
    const dayOk = domF==="*"&&dowF==="*" ? true : domF!=="*"&&dowF!=="*" ? (domOk||dowOk) : domF!=="*" ? domOk : dowOk;
    if (!dayOk) { d.setDate(d.getDate()+1); d.setHours(0,0,0,0); continue; }
    if (!matchesField(hourF, hour, 0)) { d.setHours(d.getHours()+1,0,0,0); continue; }
    if (!matchesField(minF, min, 0)) { d.setMinutes(d.getMinutes()+1,0,0); continue; }
    runs.push(new Date(d));
    d.setMinutes(d.getMinutes()+1,0,0);
  }
  return runs;
}

function formatRunDate(date) {
  const now = new Date();
  const diff = date - now;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const relative = mins < 60 ? `in ${mins}m` : hours < 24 ? `in ${hours}h ${mins%60}m` : `in ${days}d ${hours%24}h`;
  const DN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h = date.getHours(), m = String(date.getMinutes()).padStart(2,"0");
  const ampm = h>=12?"PM":"AM", h12 = h%12===0?12:h%12;
  return { full: `${DN[date.getDay()]}, ${MN[date.getMonth()]} ${date.getDate()} at ${h12}:${m} ${ampm}`, relative };
}

// ─── CRON PARSER ─────────────────────────────────────────────────────────────

function parseField(value, names = []) {
  if (value === "*") return { type: "any", label: "every" };
  if (value.startsWith("*/")) return { type: "step", label: `every ${value.slice(2)}`, step: parseInt(value.slice(2)) };
  if (value.includes("/")) {
    const [range, step] = value.split("/");
    const [start] = range.split("-");
    return { type: "step-from", label: `every ${step} starting at ${names[+start] || start}` };
  }
  if (value.includes("-")) {
    const [a, b] = value.split("-");
    return { type: "range", label: `${names[+a]||a} through ${names[+b]||b}` };
  }
  if (value.includes(",")) {
    const parts = value.split(",").map(v => names[+v] || v);
    const last = parts.pop();
    return { type: "list", label: parts.join(", ") + " and " + last };
  }
  const n = parseInt(value);
  return { type: "specific", label: names[n] !== undefined ? names[n] : value, raw: n };
}

const MONTHS = ["","January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function explainCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { error: "Needs exactly 5 fields." };
  const [minR, hourR, domR, monR, dowR] = parts;
  try {
    const minute = parseField(minR);
    const hour = parseField(hourR);
    const dom = parseField(domR);
    const month = parseField(monR, MONTHS);
    const dow = parseField(dowR, DAYS);
    let when = "";
    if (minute.type==="any"&&hour.type==="any") when="every minute";
    else if (minute.type==="step"&&hour.type==="any") when=`every ${minute.step} minutes`;
    else if (hour.type==="specific"&&minute.type==="specific") {
      const h=hour.raw, ampm=h>=12?"PM":"AM", h12=h%12===0?12:h%12;
      when=`at ${h12}:${String(minute.raw).padStart(2,"0")} ${ampm}`;
    } else if (hour.type==="step") {
      when=`every ${hour.step} hours`;
      if (minute.type==="specific") when+=` at minute ${minute.label}`;
    } else when=`at minute ${minute.label}`;
    const hasDom=domR!=="*", hasDow=dowR!=="*";
    let dayDesc = !hasDom&&!hasDow ? "every day" : hasDom&&!hasDow ? `on day ${dom.label} of the month` : !hasDom&&hasDow ? `on ${dow.label}` : `on day ${dom.label} or ${dow.label}`;
    let monthDesc = monR!=="*" ? ` in ${month.label}` : "";
    const sentence = (when.charAt(0).toUpperCase()+when.slice(1)) + `, ${dayDesc}${monthDesc}`;
    return {
      sentence,
      fields: [
        { name:"Minute", value:minR, parsed:minute },
        { name:"Hour", value:hourR, parsed:hour },
        { name:"Day of Month", value:domR, parsed:dom },
        { name:"Month", value:monR, parsed:month },
        { name:"Day of Week", value:dowR, parsed:dow },
      ]
    };
  } catch(e) { return { error: "Could not parse. Check syntax." }; }
}

// ─── CRON TOOL ────────────────────────────────────────────────────────────────

const EXAMPLES = [
  { expr:"0 9 * * 1-5", label:"Weekday mornings" },
  { expr:"*/15 * * * *", label:"Every 15 mins" },
  { expr:"0 0 1 * *", label:"Monthly reset" },
  { expr:"30 18 * * 5", label:"Friday evening" },
  { expr:"0 */6 * * *", label:"Every 6 hours" },
  { expr:"0 0 * * 0", label:"Weekly Sunday" },
];

function CronTool({ C }) {
  const [input, setInput] = useState("0 9 * * 1-5");
  const [result, setResult] = useState(null);
  const [nextRuns, setNextRuns] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (input.trim()) {
      const res = explainCron(input);
      setResult(res);
      setNextRuns(res.error ? [] : getNextRuns(input));
    } else { setResult(null); setNextRuns([]); }
  }, [input]);

  const parts = input.trim().split(/\s+/);
  const fieldLabels = ["MIN","HOUR","DOM","MON","DOW"];

  const T = makeTool(C);

  return (
    <div style={T.wrap}>
      <div style={T.fieldLabels}>
        {fieldLabels.map((l,i) => (
          <div key={i} style={{...T.fieldLabel, color: parts[i]&&parts[i]!=="*"?C.accent:C.textMuted}}>{l}</div>
        ))}
      </div>
      <div style={T.inputRow} className="t-input-row">
        <span style={T.prompt}>$</span>
        <input style={T.input} value={input} onChange={e=>setInput(e.target.value)}
          spellCheck={false} placeholder="* * * * *" className="t-input" />
      </div>

      {result?.error && (
        <div style={T.errorBox}><span style={T.errorDot}>!</span>{result.error}</div>
      )}

      {result?.sentence && (
        <div style={T.sentenceBox}>
          <span style={T.sentenceTag}>RUNS</span>
          <span style={T.sentenceText}>{result.sentence}</span>
          <button style={{...T.copyBtn, ...(copied?T.copiedBtn:{})}}
            onClick={()=>{navigator.clipboard.writeText(result.sentence);setCopied(true);setTimeout(()=>setCopied(false),1500)}}
            className="t-copy">
            {copied?"✓":"COPY"}
          </button>
        </div>
      )}

      {nextRuns.length > 0 && (
        <div style={T.nextBox}>
          <div style={T.nextHeader}>
            <span style={T.nextTitle}>NEXT 5 RUNS</span>
            <span style={T.nextSub}>your local time</span>
          </div>
          {nextRuns.map((date,i) => {
            const {full, relative} = formatRunDate(date);
            return (
              <div key={i} style={T.nextRow} className="t-next-row">
                <span style={T.nextIdx}>{String(i+1).padStart(2,"0")}</span>
                <span style={T.nextFull}>{full}</span>
                <span style={T.nextRel}>{relative}</span>
              </div>
            );
          })}
        </div>
      )}

      {result?.fields && (
        <div style={T.fieldsBox}>
          {result.fields.map((f,i) => (
            <div key={i} style={T.fieldRow} className="t-field-row">
              <span style={T.fName}>{f.name}</span>
              <span style={T.fVal}>{f.value}</span>
              <span style={T.fArrow}>→</span>
              <span style={T.fParsed}>{f.parsed.label}</span>
            </div>
          ))}
        </div>
      )}

      <div style={T.exGrid}>
        {EXAMPLES.map((ex,i) => (
          <button key={i} style={T.exBtn} className="t-ex-btn" onClick={()=>setInput(ex.expr)}>
            <span style={T.exExpr}>{ex.expr}</span>
            <span style={T.exLabel}>{ex.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function makeTool(C) {
  return {
    wrap: { fontFamily:"'IBM Plex Mono',monospace", color:C.text, display:"flex", flexDirection:"column", gap:"12px" },
    fieldLabels: { display:"flex", paddingLeft:"28px", marginBottom:"-4px" },
    fieldLabel: { flex:1, fontSize:"10px", letterSpacing:"2px", textAlign:"center", transition:"color 0.2s" },
    inputRow: { display:"flex", alignItems:"center", background:C.inputBg, border:`1px solid ${C.border2}`, borderRadius:"4px", padding:"14px 18px", gap:"12px" },
    prompt: { color:C.accent, fontSize:"18px", fontWeight:"bold", userSelect:"none" },
    input: { background:"transparent", border:"none", outline:"none", color:C.text, fontSize:"clamp(16px,3vw,26px)", fontFamily:"inherit", letterSpacing:"6px", width:"100%", caretColor:C.accent },
    errorBox: { background:C.card, border:`1px solid ${C.border}`, borderLeft:"3px solid #cc3333", borderRadius:"4px", padding:"14px 18px", color:"#cc5555", fontSize:"13px", display:"flex", gap:"10px", alignItems:"center" },
    errorDot: { border:"1px solid #cc3333", borderRadius:"50%", width:"18px", height:"18px", textAlign:"center", lineHeight:"18px", fontSize:"11px", flexShrink:0 },
    sentenceBox: { background:C.inputBg, border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.accent}`, borderRadius:"4px", padding:"16px 18px", display:"flex", gap:"14px", alignItems:"flex-start", flexWrap:"wrap" },
    sentenceTag: { fontSize:"10px", letterSpacing:"3px", color:C.accent, flexShrink:0, marginTop:"3px" },
    sentenceText: { fontSize:"clamp(13px,2vw,16px)", color:C.text, lineHeight:"1.5", flex:1, minWidth:"160px" },
    copyBtn: { background:"transparent", border:`1px solid ${C.border2}`, color:C.textMuted, fontFamily:"inherit", fontSize:"10px", letterSpacing:"2px", padding:"5px 10px", cursor:"pointer", borderRadius:"2px", transition:"all 0.2s", flexShrink:0 },
    copiedBtn: { borderColor:C.accent, color:C.accent },
    nextBox: { background:C.inputBg, border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.greenDim}`, borderRadius:"4px", overflow:"hidden" },
    nextHeader: { display:"flex", gap:"12px", alignItems:"baseline", padding:"11px 18px", borderBottom:`1px solid ${C.border}` },
    nextTitle: { fontSize:"10px", letterSpacing:"3px", color:C.green },
    nextSub: { fontSize:"11px", color:C.textMuted },
    nextRow: { display:"flex", alignItems:"center", padding:"10px 18px", borderBottom:`1px solid ${C.border}`, gap:"14px", transition:"background 0.15s", flexWrap:"wrap" },
    nextIdx: { color:C.green, fontSize:"11px", fontWeight:"bold", width:"20px", flexShrink:0 },
    nextFull: { color:C.textSub, fontSize:"12px", flex:1, minWidth:"140px" },
    nextRel: { color:C.green, fontSize:"11px", flexShrink:0 },
    fieldsBox: { background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:"4px", overflow:"hidden" },
    fieldRow: { display:"flex", alignItems:"center", padding:"10px 18px", borderBottom:`1px solid ${C.border}`, gap:"14px", fontSize:"12px", flexWrap:"wrap" },
    fName: { color:C.textMuted, width:"100px", flexShrink:0, fontSize:"10px", letterSpacing:"1px" },
    fVal: { color:C.accent, width:"55px", flexShrink:0, fontWeight:"bold" },
    fArrow: { color:C.border2 },
    fParsed: { color:C.textSub, flex:1 },
    exGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(150px,1fr))", gap:"6px", marginTop:"4px" },
    exBtn: { background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:"3px", padding:"10px 14px", cursor:"pointer", textAlign:"left", display:"flex", flexDirection:"column", gap:"3px", fontFamily:"inherit", transition:"all 0.15s" },
    exExpr: { color:C.accent, fontSize:"12px", letterSpacing:"1px" },
    exLabel: { color:C.textMuted, fontSize:"10px", letterSpacing:"1px" },
  };
}

// ─── LANDING ─────────────────────────────────────────────────────────────────

export default function Landing() {
  const toolRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(true);
  const C = dark ? DARK : LIGHT;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTool = () => toolRef.current?.scrollIntoView({ behavior:"smooth" });

  const L = makeLayout(C);

  return (
    <div style={L.root}>
      <style>{makeCss(C)}</style>

      {/* ── NAV ── */}
      <nav style={{...L.nav, ...(scrolled ? L.navScrolled : {})}}>
        <div style={L.navLogo}>CRON<span style={L.navAccent}>.EXPLAIN</span></div>
        <div style={L.navLinks}>
          <a href="/docs" style={L.navLink} className="nav-link">Docs</a>
          <a href="/scheduler" style={L.navLink} className="nav-link">Scheduler</a>
          <button
            style={L.themeToggle}
            onClick={() => setDark(d => !d)}
            className="theme-toggle"
            aria-label={C.toggleLabel}
            title={C.toggleLabel}
          >
            {C.toggleIcon}
          </button>
          <button style={L.navCta} className="nav-cta" onClick={scrollToTool}>
            Try it →
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={L.hero}>
        <div style={L.gridBg} aria-hidden="true">
          {Array.from({length: 12}).map((_,i) => (
            <div key={i} style={{...L.gridLine, left:`${(i/11)*100}%`}} />
          ))}
        </div>

        <div style={L.heroContent}>
          <div style={L.heroBadge} className="hero-badge">
            <span style={L.badgeDot} />
            Free · No sign-up · Runs in browser
          </div>

          <h1 style={L.heroTitle} className="hero-title">
            Stop Googling<br />
            <span style={L.heroTitleAccent}>cron syntax.</span>
          </h1>

          <p style={L.heroSub} className="hero-sub">
            Paste any cron expression. Get a plain-English explanation,
            a field-by-field breakdown, and the next 5 scheduled run times.
          </p>

          <div style={L.heroCtas}>
            <button style={L.ctaPrimary} className="cta-primary" onClick={scrollToTool}>
              Try it now — it's free
            </button>
            <div style={L.ctaNote}>No account. No install. Just works.</div>
          </div>

          {/* hero preview window */}
          <div style={L.heroPreview} className="hero-preview">
            <div style={L.previewBar}>
              <div style={L.previewDots}>
                <span style={{...L.dot, background:"#ff5f57"}} />
                <span style={{...L.dot, background:"#febc2e"}} />
                <span style={{...L.dot, background:"#28c840"}} />
              </div>
              <span style={L.previewTitle}>cron.explain</span>
            </div>
            <div style={L.previewBody}>
              <div style={L.previewExpr}>
                <span style={L.previewPrompt}>$</span>
                <span style={L.previewCode}>0 9 * * 1-5</span>
              </div>
              <div style={L.previewResult}>
                <span style={L.previewTag}>RUNS</span>
                <span style={L.previewSentence}>At 9:00 AM, on Monday through Friday</span>
              </div>
              <div style={L.previewRuns}>
                {["Mon, Feb 24 at 9:00 AM","Tue, Feb 25 at 9:00 AM","Wed, Feb 26 at 9:00 AM"].map((r,i) => (
                  <div key={i} style={L.previewRunRow}>
                    <span style={L.previewRunIdx}>{String(i+1).padStart(2,"0")}</span>
                    <span style={L.previewRunDate}>{r}</span>
                    <span style={L.previewRunRel}>in {i+1}d</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={L.features}>
        <div style={L.featuresInner}>
          <div style={L.sectionLabel}>WHY USE IT</div>
          <h2 style={L.featuresTitle}>One tool. Three answers.</h2>
          <div style={L.featureGrid}>
            {[
              { num:"01", title:"Plain English", desc:"Every cron expression decoded into a clear human-readable sentence. No more hunting through Stack Overflow.", icon:"✦" },
              { num:"02", title:"Field Breakdown", desc:"See exactly what each of the 5 fields means — minute, hour, day, month, weekday — explained individually.", icon:"⊞" },
              { num:"03", title:"Next Run Times", desc:"The next 5 exact dates your cron job will fire, calculated in your local timezone. Know precisely when it runs.", icon:"◷" },
            ].map((f,i) => (
              <div key={i} style={L.featureCard} className="feature-card">
                <div style={L.featureNum}>{f.num}</div>
                <div style={L.featureIcon}>{f.icon}</div>
                <h3 style={L.featureTitle}>{f.title}</h3>
                <p style={L.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE TOOL ── */}
      <section style={L.toolSection} ref={toolRef}>
        <div style={L.toolInner}>
          <div style={L.sectionLabel}>LIVE TOOL</div>
          <h2 style={L.toolTitle}>Try it right here.</h2>
          <p style={L.toolSub}>No account. No install. Runs entirely in your browser.</p>
          <div style={L.toolCard}>
            <div style={L.toolCardHeader}>
              <div style={L.previewDots}>
                <span style={{...L.dot, background:"#ff5f57"}} />
                <span style={{...L.dot, background:"#febc2e"}} />
                <span style={{...L.dot, background:"#28c840"}} />
              </div>
              <span style={L.toolCardTitle}>cron.explain — live</span>
            </div>
            <div style={L.toolCardBody}>
              <CronTool C={C} />
            </div>
          </div>
        </div>
      </section>

      {/* ── SCHEDULER PROMO ── */}
      <section style={L.promoSection}>
        <div style={L.promoInner}>
          <div style={L.promoCard} className="promo-card">
            <div style={L.promoLeft}>
              <div style={L.sectionLabel}>NEW</div>
              <h2 style={L.promoTitle}>Never miss a cron job.</h2>
              <p style={L.promoDesc}>
                Register any cron expression and get an email alert before it fires.
                Free. No account required — just your email.
              </p>
            </div>
            <a href="/scheduler" style={L.promoCta} className="promo-cta">
              Set up alerts →
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={L.footer}>
        <div style={L.footerLogo}>CRON<span style={L.navAccent}>.EXPLAIN</span></div>
        <p style={L.footerText}>
          Built for developers who are tired of Googling cron syntax.
        </p>
        <div style={L.footerLinks}>
          <a href="/docs" style={L.footerLink} className="footer-link">Docs</a>
          <span style={L.footerDivider}>·</span>
          <a href="/scheduler" style={L.footerLink} className="footer-link">Scheduler</a>
          <span style={L.footerDivider}>·</span>
          <a href="/terms" style={L.footerLink} className="footer-link">Terms & Privacy</a>
          <span style={L.footerDivider}>·</span>
          <a href="https://github.com/mykelayo/cron-explain" target="_blank" rel="noreferrer" style={L.footerLink} className="footer-link">GitHub</a>
        </div>
        <div style={L.footerCopy}>© 2026 Cron.Explain · MIT License</div>
      </footer>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

function makeLayout(C) {
  return {
    root: { background:C.bg, minHeight:"100vh", fontFamily:"'IBM Plex Mono','Courier New',monospace", color:C.text, overflowX:"hidden", transition:"background 0.2s, color 0.2s" },
    nav: { position:"fixed", top:0, left:0, right:0, zIndex:100, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 32px", transition:"all 0.3s", borderBottom:"1px solid transparent" },
    navScrolled: { background:C.navBg, borderBottomColor:C.border, backdropFilter:"blur(10px)" },
    navLogo: { fontSize:"18px", fontWeight:"800", color:C.text, letterSpacing:"-0.5px" },
    navAccent: { color:C.accent },
    navLinks: { display:"flex", alignItems:"center", gap:"20px" },
    navLink: { color:C.textSub, textDecoration:"none", fontSize:"12px", letterSpacing:"1px", transition:"color 0.2s" },
    themeToggle: { background:C.toggleBg, border:`1px solid ${C.border2}`, borderRadius:"6px", padding:"5px 10px", cursor:"pointer", fontSize:"14px", transition:"all 0.2s", lineHeight:1 },
    navCta: { background:C.accent, color:dark_ref(C), border:"none", padding:"8px 16px", fontSize:"11px", letterSpacing:"1px", fontFamily:"inherit", fontWeight:"700", cursor:"pointer", borderRadius:"2px", transition:"all 0.2s" },

    hero: { position:"relative", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"120px 20px 80px", overflow:"hidden" },
    gridBg: { position:"absolute", inset:0, opacity:0.04, pointerEvents:"none" },
    gridLine: { position:"absolute", top:0, bottom:0, width:"1px", background:C.accent },
    heroContent: { maxWidth:"860px", width:"100%", textAlign:"center", position:"relative", zIndex:1 },
    heroBadge: { display:"inline-flex", alignItems:"center", gap:"8px", fontSize:"11px", letterSpacing:"2px", color:C.textMuted, border:`1px solid ${C.border}`, padding:"6px 14px", borderRadius:"2px", marginBottom:"40px" },
    badgeDot: { width:"6px", height:"6px", borderRadius:"50%", background:C.green, boxShadow:`0 0 6px ${C.green}`, flexShrink:0 },
    heroTitle: { fontSize:"clamp(42px,9vw,88px)", fontWeight:"800", margin:"0 0 24px 0", lineHeight:"1.0", letterSpacing:"-3px", color:C.text, fontFamily:"'DM Serif Display','Georgia',serif" },
    heroTitleAccent: { color:C.accent, fontStyle:"italic" },
    heroSub: { fontSize:"clamp(13px,2vw,16px)", color:C.heroSub, lineHeight:"1.8", margin:"0 0 48px 0", maxWidth:"560px", marginLeft:"auto", marginRight:"auto" },
    heroCtas: { display:"flex", flexDirection:"column", alignItems:"center", gap:"12px", marginBottom:"52px" },
    ctaPrimary: { background:C.accent, color:dark_ref(C), border:"none", padding:"15px 32px", fontSize:"13px", letterSpacing:"2px", fontFamily:"inherit", fontWeight:"700", cursor:"pointer", borderRadius:"2px", transition:"all 0.2s" },
    ctaNote: { fontSize:"11px", color:C.textMuted, letterSpacing:"1px" },

    heroPreview: { background:C.previewBg, border:`1px solid ${C.border}`, borderRadius:"8px", overflow:"hidden", maxWidth:"520px", margin:"0 auto", textAlign:"left", boxShadow: C === DARK ? "0 40px 80px rgba(0,0,0,0.6)" : "0 20px 60px rgba(0,0,0,0.12)" },
    previewBar: { display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderBottom:`1px solid ${C.border}`, background:C.inputBg },
    previewDots: { display:"flex", gap:"6px" },
    dot: { width:"10px", height:"10px", borderRadius:"50%" },
    previewTitle: { fontSize:"11px", color:C.textMuted, letterSpacing:"1px", flex:1, textAlign:"center" },
    previewBody: { padding:"20px" },
    previewExpr: { display:"flex", alignItems:"center", gap:"10px", marginBottom:"14px" },
    previewPrompt: { color:C.accent, fontSize:"16px", fontWeight:"bold" },
    previewCode: { color:C.text, fontSize:"17px", letterSpacing:"6px" },
    previewResult: { display:"flex", gap:"12px", alignItems:"center", background:C.inputBg, border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.accent}`, padding:"12px 14px", marginBottom:"12px", borderRadius:"3px" },
    previewTag: { fontSize:"9px", letterSpacing:"3px", color:C.accent, flexShrink:0 },
    previewSentence: { fontSize:"13px", color:C.text },
    previewRuns: { display:"flex", flexDirection:"column", background:C.inputBg, border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.greenDim}`, borderRadius:"3px", overflow:"hidden" },
    previewRunRow: { display:"flex", alignItems:"center", gap:"12px", padding:"9px 14px", borderBottom:`1px solid ${C.border}`, fontSize:"12px" },
    previewRunIdx: { color:C.green, fontWeight:"bold", width:"18px", flexShrink:0 },
    previewRunDate: { color:C.textSub, flex:1 },
    previewRunRel: { color:C.green, fontSize:"11px" },

    features: { padding:"100px 20px", borderTop:`1px solid ${C.border}` },
    featuresInner: { maxWidth:"960px", margin:"0 auto" },
    sectionLabel: { fontSize:"10px", letterSpacing:"4px", color:C.textMuted, marginBottom:"16px" },
    featuresTitle: { fontSize:"clamp(26px,5vw,44px)", fontWeight:"800", margin:"0 0 56px 0", color:C.text, letterSpacing:"-1px", fontFamily:"'DM Serif Display','Georgia',serif" },
    featureGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:"2px" },
    featureCard: { background:C.card, border:`1px solid ${C.border}`, padding:"32px 28px", transition:"all 0.2s", cursor:"default" },
    featureNum: { fontSize:"10px", letterSpacing:"2px", color:C.border2, marginBottom:"20px" },
    featureIcon: { fontSize:"24px", color:C.accent, marginBottom:"16px" },
    featureTitle: { fontSize:"17px", fontWeight:"700", color:C.text, margin:"0 0 12px 0" },
    featureDesc: { fontSize:"13px", color:C.textSub, lineHeight:"1.8", margin:0 },

    toolSection: { padding:"100px 20px", borderTop:`1px solid ${C.border}` },
    toolInner: { maxWidth:"780px", margin:"0 auto" },
    toolTitle: { fontSize:"clamp(26px,5vw,44px)", fontWeight:"800", margin:"0 0 12px 0", color:C.text, letterSpacing:"-1px", fontFamily:"'DM Serif Display','Georgia',serif" },
    toolSub: { fontSize:"13px", color:C.textSub, margin:"0 0 36px 0" },
    toolCard: { background:C.card2, border:`1px solid ${C.border}`, borderRadius:"8px", overflow:"hidden" },
    toolCardHeader: { display:"flex", alignItems:"center", gap:"12px", padding:"12px 20px", borderBottom:`1px solid ${C.border}`, background:C.inputBg },
    toolCardTitle: { fontSize:"11px", color:C.textMuted, letterSpacing:"1px", flex:1, textAlign:"center" },
    toolCardBody: { padding:"24px 20px" },

    promoSection: { padding:"80px 20px", borderTop:`1px solid ${C.border}`, background:C.bg2 },
    promoInner: { maxWidth:"960px", margin:"0 auto" },
    promoCard: { border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.accent}`, background:C.card, borderRadius:"4px", padding:"36px 40px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"40px", flexWrap:"wrap" },
    promoLeft: { flex:1, minWidth:"240px" },
    promoTitle: { fontSize:"clamp(22px,4vw,32px)", fontWeight:"800", color:C.text, margin:"8px 0 12px 0", letterSpacing:"-0.5px", fontFamily:"'DM Serif Display','Georgia',serif" },
    promoDesc: { fontSize:"14px", color:C.textSub, lineHeight:"1.8", margin:0 },
    promoCta: { background:C.accent, color:dark_ref(C), textDecoration:"none", padding:"14px 28px", fontSize:"12px", letterSpacing:"2px", fontWeight:"700", fontFamily:"'IBM Plex Mono',monospace", borderRadius:"2px", flexShrink:0, transition:"all 0.2s", display:"inline-block" },

    footer: { padding:"60px 20px", borderTop:`1px solid ${C.border}`, textAlign:"center" },
    footerLogo: { fontSize:"20px", fontWeight:"800", color:C.text, marginBottom:"16px", letterSpacing:"-0.5px" },
    footerText: { fontSize:"13px", color:C.textMuted, lineHeight:"2", margin:"0 0 20px 0" },
    footerLinks: { display:"flex", justifyContent:"center", gap:"12px", alignItems:"center", marginBottom:"24px", flexWrap:"wrap" },
    footerLink: { color:C.textSub, textDecoration:"none", fontSize:"12px", letterSpacing:"1px", transition:"color 0.2s" },
    footerDivider: { color:C.border2 },
    footerCopy: { fontSize:"11px", color:C.textFaint, letterSpacing:"1px" },
  };
}

// Returns black for light-bg buttons, dark bg color for dark-bg buttons
function dark_ref(C) { return C === DARK ? "#000" : "#fff"; }

function makeCss(C) {
  return `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700;800&family=DM+Serif+Display:ital@0;1&display=swap');
    * { box-sizing: border-box; }
    body { margin: 0; background: ${C.bg}; transition: background 0.2s; }

    .nav-link:hover     { color: ${C.accent} !important; }
    .nav-cta:hover      { opacity: 0.85; transform: translateY(-1px); }
    .cta-primary:hover  { opacity: 0.88; transform: translateY(-2px); box-shadow: 0 8px 24px ${C.accentDim}; }
    .theme-toggle:hover { border-color: ${C.accent} !important; }
    .feature-card:hover { border-color: ${C.border2} !important; }
    .footer-link:hover  { color: ${C.accent} !important; }
    .promo-cta:hover    { opacity: 0.85; transform: translateY(-1px); }

    .hero-badge   { animation: fadeUp 0.5s ease 0.1s both; }
    .hero-title   { animation: fadeUp 0.5s ease 0.2s both; }
    .hero-sub     { animation: fadeUp 0.5s ease 0.3s both; }
    .hero-preview { animation: fadeUp 0.6s ease 0.4s both; }

    .t-input-row:focus-within { border-color: ${C.accent} !important; }
    .t-input::placeholder { color: ${C.border2}; letter-spacing: 6px; }
    .t-copy:hover    { border-color: ${C.accent} !important; color: ${C.accent} !important; }
    .t-ex-btn:hover  { border-color: ${C.border2} !important; }
    .t-field-row:last-child { border-bottom: none !important; }
    .t-next-row:last-child  { border-bottom: none !important; }
    .t-next-row:hover  { background: ${C.card}; }
    .t-field-row:hover { background: ${C.card}; }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    ::selection { background: ${C.accentDim}; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: ${C.bg}; }
    ::-webkit-scrollbar-thumb { background: ${C.border2}; }

    @media (max-width: 600px) {
      nav { padding: 14px 16px !important; }
      nav .nav-link[href="/docs"], nav .nav-link[href="/scheduler"] { display: none; }
    }
  `;
}
