// src/Landing.jsx
import { useState, useEffect, useRef } from "react";
import { useTheme } from "./theme.js";          
import ThemeNav, { themeCSS } from "./ThemeNav.jsx";
import { GITHUB_URL } from "./config.js";

// ─── CRON ENGINE ──────────────────────────────────────────────────────────────

function matchesField(value, n, min) {
  if (value === "*") return true;
  if (value.startsWith("*/")) return (n - min) % parseInt(value.slice(2)) === 0;
  // step-from: e.g. "10/5" or "10-59/5"
  if (value.includes("/")) {
    const [range, step] = value.split("/");
    const start = range === "*" ? min : parseInt(range.split("-")[0]);
    return n >= start && (n - start) % parseInt(step) === 0;
  }
  if (value.includes("-")) { const [a,b]=value.split("-"); return n>=parseInt(a)&&n<=parseInt(b); }
  if (value.includes(",")) return value.split(",").map(Number).includes(n);
  return parseInt(value) === n;
}

function getNextRuns(expr, count = 5) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return [];
  const [minF, hourF, domF, monF, dowF] = parts;
  const runs = [];
  const d = new Date(); d.setSeconds(0,0); d.setMinutes(d.getMinutes()+1);
  let it = 0;
  while (runs.length < count && it++ < 500000) {
    const mon=d.getMonth()+1, dom=d.getDate(), dow=d.getDay(), hour=d.getHours(), min=d.getMinutes();
    if (!matchesField(monF,mon,1)) { d.setMonth(d.getMonth()+1); d.setDate(1); d.setHours(0,0,0,0); continue; }
    const domOk=matchesField(domF,dom,1), dowOk=matchesField(dowF,dow,0);
    const dayOk=domF==="*"&&dowF==="*"?true:domF!=="*"&&dowF!=="*"?(domOk||dowOk):domF!=="*"?domOk:dowOk;
    if (!dayOk) { d.setDate(d.getDate()+1); d.setHours(0,0,0,0); continue; }
    if (!matchesField(hourF,hour,0)) { d.setHours(d.getHours()+1,0,0,0); continue; }
    if (!matchesField(minF,min,0)) { d.setMinutes(d.getMinutes()+1,0,0); continue; }
    runs.push(new Date(d)); d.setMinutes(d.getMinutes()+1,0,0);
  }
  return runs;
}

function fmtRun(date) {
  const now=new Date(), diff=date-now, mins=Math.floor(diff/60000), hours=Math.floor(mins/60), days=Math.floor(hours/24);
  const rel = mins<60?`in ${mins}m`:hours<24?`in ${hours}h ${mins%60}m`:`in ${days}d ${hours%24}h`;
  const DN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], MN=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h=date.getHours(), m=String(date.getMinutes()).padStart(2,"0"), ampm=h>=12?"PM":"AM", h12=h%12||12;
  return { full:`${DN[date.getDay()]}, ${MN[date.getMonth()]} ${date.getDate()} at ${h12}:${m} ${ampm}`, rel };
}

// ─── CRON PARSER ─────────────────────────────────────────────────────────────

function parseField(value, names=[]) {
  if (value==="*") return { type:"any", label:"every" };
  if (value.startsWith("*/")) return { type:"step", label:`every ${value.slice(2)}`, step:parseInt(value.slice(2)) };
  if (value.includes("/")) { const [r,s]=value.split("/"); const [st]=r.split("-"); return { type:"step-from", label:`every ${s} from ${names[+st]||st}` }; }
  if (value.includes("-")) { const [a,b]=value.split("-"); return { type:"range", label:`${names[+a]||a}–${names[+b]||b}` }; }
  if (value.includes(",")) { const p=value.split(",").map(v=>names[+v]||v); const last=p.pop(); return { type:"list", label:p.join(", ")+" and "+last }; }
  const n=parseInt(value); return { type:"specific", label:names[n]!==undefined?names[n]:value, raw:n };
}
const MONTHS=["","January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function explainCron(expr) {
  const parts=expr.trim().split(/\s+/);
  if (parts.length!==5) return { error:"Needs exactly 5 fields." };
  const [minR,hourR,domR,monR,dowR]=parts;
  try {
    const minute=parseField(minR), hour=parseField(hourR), dom=parseField(domR);
    const month=parseField(monR,MONTHS), dow=parseField(dowR,DAYS);
    let when="";
    if (minute.type==="any"&&hour.type==="any") when="every minute";
    else if (minute.type==="step"&&hour.type==="any") when=`every ${minute.step} minutes`;
    else if (hour.type==="specific"&&minute.type==="specific") { const h=hour.raw, ap=h>=12?"PM":"AM", h12=h%12||12; when=`at ${h12}:${String(minute.raw).padStart(2,"0")} ${ap}`; }
    else if (hour.type==="step") { when=`every ${hour.step} hours`; if (minute.type==="specific") when+=` at minute ${minute.label}`; }
    else when=`at minute ${minute.label}`;
    const hasDom=domR!=="*", hasDow=dowR!=="*";
    const dayDesc=!hasDom&&!hasDow?"every day":hasDom&&!hasDow?`on day ${dom.label} of month`:!hasDom&&hasDow?`on ${dow.label}`:`on day ${dom.label} or ${dow.label}`;
    const monthDesc=monR!=="*"?` in ${month.label}`:"";
    return { sentence:(when[0].toUpperCase()+when.slice(1))+`, ${dayDesc}${monthDesc}`, fields:[{name:"Minute",value:minR,parsed:minute},{name:"Hour",value:hourR,parsed:hour},{name:"Day of Month",value:domR,parsed:dom},{name:"Month",value:monR,parsed:month},{name:"Day of Week",value:dowR,parsed:dow}] };
  } catch { return { error:"Could not parse." }; }
}

// ─── CRON TOOL ────────────────────────────────────────────────────────────────

const EXAMPLES=[
  {expr:"0 9 * * 1-5",label:"Weekday 9am"},
  {expr:"*/15 * * * *",label:"Every 15 min"},
  {expr:"0 0 1 * *",label:"Monthly"},
  {expr:"30 18 * * 5",label:"Fri 6:30pm"},
  {expr:"0 */6 * * *",label:"Every 6h"},
  {expr:"0 0 * * 0",label:"Weekly Sun"},
];

function CronTool({ C }) {
  const [input,setInput]=useState("0 9 * * 1-5");
  const [result,setResult]=useState(null);
  const [runs,setRuns]=useState([]);
  const [copied,setCopied]=useState(false);

  useEffect(() => {
    if (!input.trim()) { setResult(null); setRuns([]); return; }
    const r=explainCron(input); setResult(r); setRuns(r.error?[]:getNextRuns(input));
  },[input]);

  const parts=input.trim().split(/\s+/);
  const A=C.accent;
  return (
    <div style={{fontFamily:"'IBM Plex Mono',monospace",color:C.text,display:"flex",flexDirection:"column",gap:"10px"}}>
      <div style={{display:"flex",paddingLeft:"26px",marginBottom:"-2px"}}>
        {["MIN","HOUR","DOM","MON","DOW"].map((l,i)=>(
          <div key={i} style={{flex:1,fontSize:"9px",letterSpacing:"2px",textAlign:"center",color:parts[i]&&parts[i]!=="*"?A:C.textMuted,transition:"color 0.2s"}}>{l}</div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",background:C.inputBg,border:`1.5px solid ${C.border2}`,borderRadius:"5px",padding:"13px 16px",gap:"10px"}} className="tool-input-row">
        <span style={{color:A,fontSize:"17px",fontWeight:"bold",userSelect:"none"}}>$</span>
        <input style={{background:"transparent",border:"none",outline:"none",color:C.text,fontSize:"clamp(15px,3vw,24px)",fontFamily:"inherit",letterSpacing:"6px",width:"100%",caretColor:A}} value={input} onChange={e=>setInput(e.target.value)} placeholder="* * * * *" className="tool-input" spellCheck={false} />
      </div>
      {result?.error && <div style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:"3px solid #cc3333",borderRadius:"4px",padding:"12px 16px",color:"#cc5555",fontSize:"13px"}}>{result.error}</div>}
      {result?.sentence && (
        <div style={{background:C.inputBg,border:`1px solid ${C.border}`,borderLeft:`3px solid ${A}`,borderRadius:"4px",padding:"14px 16px",display:"flex",gap:"12px",alignItems:"flex-start",flexWrap:"wrap"}}>
          <span style={{fontSize:"9px",letterSpacing:"3px",color:A,flexShrink:0,marginTop:"3px"}}>RUNS</span>
          <span style={{fontSize:"clamp(13px,2vw,15px)",color:C.text,lineHeight:"1.6",flex:1,minWidth:"160px"}}>{result.sentence}</span>
          <button style={{background:"transparent",border:`1px solid ${C.border2}`,color:copied?A:C.textMuted,fontFamily:"inherit",fontSize:"10px",letterSpacing:"2px",padding:"4px 10px",cursor:"pointer",borderRadius:"2px",transition:"all 0.2s",flexShrink:0}}
            onClick={()=>{navigator.clipboard.writeText(result.sentence);setCopied(true);setTimeout(()=>setCopied(false),1500)}} className="tool-copy">
            {copied?"✓":"COPY"}
          </button>
        </div>
      )}
      {runs.length>0 && (
        <div style={{background:C.inputBg,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.green}`,borderRadius:"4px",overflow:"hidden"}}>
          <div style={{display:"flex",gap:"10px",alignItems:"baseline",padding:"10px 16px",borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:"9px",letterSpacing:"3px",color:C.green}}>NEXT 5 RUNS</span>
            <span style={{fontSize:"10px",color:C.textMuted}}>local time</span>
          </div>
          {runs.map((date,i)=>{const{full,rel}=fmtRun(date);return(
            <div key={i} style={{display:"flex",alignItems:"center",padding:"9px 16px",borderBottom:i<4?`1px solid ${C.border}`:"none",gap:"12px",flexWrap:"wrap"}}>
              <span style={{color:C.green,fontSize:"10px",fontWeight:"bold",width:"18px",flexShrink:0}}>{String(i+1).padStart(2,"0")}</span>
              <span style={{color:C.textSub,fontSize:"12px",flex:1,minWidth:"140px"}}>{full}</span>
              <span style={{color:C.green,fontSize:"11px",flexShrink:0}}>{rel}</span>
            </div>
          );})}
        </div>
      )}
      {result?.fields && (
        <div style={{background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:"4px",overflow:"hidden"}}>
          {result.fields.map((f,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",padding:"9px 16px",borderBottom:i<4?`1px solid ${C.border}`:"none",gap:"12px",fontSize:"12px",flexWrap:"wrap"}}>
              <span style={{color:C.textMuted,width:"90px",flexShrink:0,fontSize:"10px",letterSpacing:"1px"}}>{f.name}</span>
              <span style={{color:A,width:"50px",flexShrink:0,fontWeight:"bold"}}>{f.value}</span>
              <span style={{color:C.border2}}>→</span>
              <span style={{color:C.textSub,flex:1}}>{f.parsed.label}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:"5px",marginTop:"4px"}}>
        {EXAMPLES.map((ex,i)=>(
          <button key={i} style={{background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:"3px",padding:"9px 12px",cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:"2px",fontFamily:"inherit",transition:"all 0.15s"}} className="tool-ex-btn" onClick={()=>setInput(ex.expr)}>
            <span style={{color:A,fontSize:"11px",letterSpacing:"0.5px"}}>{ex.expr}</span>
            <span style={{color:C.textMuted,fontSize:"9px",letterSpacing:"1px"}}>{ex.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── LANDING PAGE ─────────────────────────────────────────────────────────────

export default function Landing() {
  const { C, isDark } = useTheme();
  const toolRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const scrollToTool = () => toolRef.current?.scrollIntoView({ behavior:"smooth" });

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, overflowX:"hidden", transition:"background 0.2s, color 0.2s" }}>
      <style>{themeCSS(C)}{landingExtras(C)}</style>

      <ThemeNav
        scrolled={scrolled}
        links={[
          { href:"/docs",      label:"Docs"      },
          { href:"/scheduler", label:"Scheduler" },
          { href:"/terms",     label:"Terms"     },
        ]}
      />

      {/* ── HERO ── */}
      <section style={{ position:"relative", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"100px 20px 80px", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, opacity:0.04, pointerEvents:"none" }} aria-hidden="true">
          {Array.from({length:10}).map((_,i)=>(<div key={i} style={{ position:"absolute", top:0, bottom:0, width:"1px", background:C.accent, left:`${(i/9)*100}%` }}/>))}
        </div>
        <div style={{ maxWidth:"840px", width:"100%", textAlign:"center", position:"relative", zIndex:1 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:"8px", fontSize:"10px", letterSpacing:"2px", color:C.textMuted, border:`1px solid ${C.border}`, padding:"6px 14px", borderRadius:"2px", marginBottom:"36px" }} className="anim-fade-up">
            <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:C.green, boxShadow:`0 0 6px ${C.green}`, flexShrink:0 }} />
            Free · No sign-up · Runs in browser
          </div>
          <h1 style={{ fontSize:"clamp(38px,9vw,84px)", fontWeight:"800", margin:"0 0 22px", lineHeight:"1.0", letterSpacing:"-3px", color:C.text, fontFamily:"'DM Serif Display',Georgia,serif" }} className="anim-fade-up">
            Stop Googling<br /><span style={{ color:C.accent, fontStyle:"italic" }}>cron syntax.</span>
          </h1>
          <p style={{ fontSize:"clamp(13px,2vw,16px)", color:C.textSub, lineHeight:"1.9", margin:"0 0 44px", maxWidth:"500px", marginLeft:"auto", marginRight:"auto" }} className="anim-fade-up">
            Paste any cron expression. Get a plain-English explanation, a field breakdown, and the next 5 run times.
          </p>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"10px", marginBottom:"48px" }}>
            <button style={{ background:C.accent, color:C.accentText, border:"none", padding:"14px 32px", fontSize:"13px", letterSpacing:"2px", fontFamily:"inherit", fontWeight:"700", cursor:"pointer", borderRadius:"3px", transition:"all 0.2s" }} onClick={scrollToTool} className="hero-cta">
              Try it now — free
            </button>
            <span style={{ fontSize:"11px", color:C.textMuted, letterSpacing:"1px" }}>No account. No install.</span>
          </div>

          {/* Preview window */}
          <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:"8px", overflow:"hidden", maxWidth:"500px", margin:"0 auto", textAlign:"left", boxShadow: isDark?"0 32px 64px rgba(0,0,0,0.5)":"0 16px 48px rgba(0,0,0,0.1)" }} className="anim-fade-up">
            <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"11px 16px", borderBottom:`1px solid ${C.border}`, background:C.inputBg }}>
              <div style={{ display:"flex", gap:"5px" }}>
                {["#ff5f57","#febc2e","#28c840"].map(c=><span key={c} style={{ width:"10px", height:"10px", borderRadius:"50%", background:c }}/>)}
              </div>
              <span style={{ fontSize:"10px", color:C.textMuted, letterSpacing:"1px", flex:1, textAlign:"center" }}>cron.explain</span>
            </div>
            <div style={{ padding:"18px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
                <span style={{ color:C.accent, fontSize:"15px", fontWeight:"bold" }}>$</span>
                <span style={{ color:C.text, fontSize:"16px", letterSpacing:"5px" }}>0 9 * * 1-5</span>
              </div>
              <div style={{ display:"flex", gap:"10px", alignItems:"center", background:C.inputBg, border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.accent}`, padding:"10px 14px", marginBottom:"10px", borderRadius:"3px" }}>
                <span style={{ fontSize:"9px", letterSpacing:"3px", color:C.accent, flexShrink:0 }}>RUNS</span>
                <span style={{ fontSize:"13px", color:C.text }}>At 9:00 AM, Monday through Friday</span>
              </div>
              <div style={{ border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.green}`, borderRadius:"3px", overflow:"hidden" }}>
                {["Mon, Feb 24 at 9:00 AM","Tue, Feb 25 at 9:00 AM","Wed, Feb 26 at 9:00 AM"].map((r,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"8px 14px", borderBottom:i<2?`1px solid ${C.border}`:"none", fontSize:"11px" }}>
                    <span style={{ color:C.green, fontWeight:"bold", width:"16px" }}>{`0${i+1}`}</span>
                    <span style={{ color:C.textSub, flex:1 }}>{r}</span>
                    <span style={{ color:C.green }}>in {i+1}d</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding:"80px 20px", borderTop:`1px solid ${C.border}` }}>
        <div style={{ maxWidth:"900px", margin:"0 auto" }}>
          <div style={{ fontSize:"9px", letterSpacing:"4px", color:C.textMuted, marginBottom:"14px" }}>WHY USE IT</div>
          <h2 style={{ fontSize:"clamp(24px,5vw,40px)", fontWeight:"800", margin:"0 0 48px", color:C.text, letterSpacing:"-1px", fontFamily:"'DM Serif Display',Georgia,serif" }}>One tool. Three answers.</h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:"2px" }}>
            {[
              {n:"01",icon:"✦",title:"Plain English",desc:"Every cron expression decoded into a clear human-readable sentence. No more Stack Overflow."},
              {n:"02",icon:"⊞",title:"Field Breakdown",desc:"See what each of the 5 fields means — minute, hour, day, month, weekday — individually."},
              {n:"03",icon:"◷",title:"Next Run Times",desc:"The next 5 exact dates your cron job fires, in your local timezone."},
            ].map((f,i)=>(
              <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, padding:"28px 24px", transition:"all 0.2s" }} className="feature-card">
                <div style={{ fontSize:"9px", letterSpacing:"2px", color:C.border2, marginBottom:"16px" }}>{f.n}</div>
                <div style={{ fontSize:"22px", color:C.accent, marginBottom:"12px" }}>{f.icon}</div>
                <h3 style={{ fontSize:"16px", fontWeight:"700", color:C.text, margin:"0 0 10px" }}>{f.title}</h3>
                <p style={{ fontSize:"13px", color:C.textSub, lineHeight:"1.8", margin:0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE TOOL ── */}
      <section style={{ padding:"80px 20px", borderTop:`1px solid ${C.border}` }} ref={toolRef}>
        <div style={{ maxWidth:"760px", margin:"0 auto" }}>
          <div style={{ fontSize:"9px", letterSpacing:"4px", color:C.textMuted, marginBottom:"14px" }}>LIVE TOOL</div>
          <h2 style={{ fontSize:"clamp(24px,5vw,40px)", fontWeight:"800", margin:"0 0 10px", color:C.text, letterSpacing:"-1px", fontFamily:"'DM Serif Display',Georgia,serif" }}>Try it right here.</h2>
          <p style={{ fontSize:"13px", color:C.textSub, margin:"0 0 32px" }}>No account. No install. Runs entirely in your browser.</p>
          <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:"8px", overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"11px 20px", borderBottom:`1px solid ${C.border}`, background:C.inputBg }}>
              <div style={{ display:"flex", gap:"5px" }}>
                {["#ff5f57","#febc2e","#28c840"].map(c=><span key={c} style={{ width:"10px", height:"10px", borderRadius:"50%", background:c }}/>)}
              </div>
              <span style={{ fontSize:"10px", color:C.textMuted, letterSpacing:"1px", flex:1, textAlign:"center" }}>cron.explain — live</span>
            </div>
            <div style={{ padding:"22px 18px" }}>
              <CronTool C={C} />
            </div>
          </div>
        </div>
      </section>

      {/* ── SCHEDULER PROMO ── */}
      <section style={{ padding:"72px 20px", borderTop:`1px solid ${C.border}`, background:C.bg2 }}>
        <div style={{ maxWidth:"900px", margin:"0 auto" }}>
          <div style={{ border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.accent}`, background:C.card, borderRadius:"4px", padding:"clamp(24px,4vw,40px)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"32px", flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:"220px" }}>
              <div style={{ fontSize:"9px", letterSpacing:"3px", color:C.accent, marginBottom:"10px" }}>NEW</div>
              <h2 style={{ fontSize:"clamp(20px,4vw,30px)", fontWeight:"800", color:C.text, margin:"0 0 10px", letterSpacing:"-0.5px", fontFamily:"'DM Serif Display',Georgia,serif" }}>Never miss a cron job.</h2>
              <p style={{ fontSize:"13px", color:C.textSub, lineHeight:"1.8", margin:0 }}>Register any expression and get an email alert before it fires. Free, no account needed.</p>
            </div>
            <a href="/scheduler" style={{ background:C.accent, color:C.accentText, textDecoration:"none", padding:"13px 26px", fontSize:"12px", letterSpacing:"2px", fontWeight:"700", fontFamily:"'IBM Plex Mono',monospace", borderRadius:"3px", flexShrink:0, transition:"all 0.2s", display:"inline-block" }} className="promo-cta">
              Set up alerts →
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding:"48px 20px", borderTop:`1px solid ${C.border}`, textAlign:"center" }}>
        <div style={{ fontSize:"18px", fontWeight:"800", color:C.text, marginBottom:"12px", letterSpacing:"-0.5px" }}>CRON<span style={{ color:C.accent }}>.EXPLAIN</span></div>
        <p style={{ fontSize:"13px", color:C.textMuted, margin:"0 0 20px", lineHeight:"1.8" }}>Built for developers who are tired of Googling cron syntax.</p>
        <div style={{ display:"flex", justifyContent:"center", gap:"16px", alignItems:"center", marginBottom:"20px", flexWrap:"wrap" }}>
          {[
            {href:"/docs",      label:"Docs"},
            {href:"/scheduler", label:"Scheduler"},
            {href:"/terms",     label:"Terms & Privacy"},
            {href:GITHUB_URL,   label:"GitHub", ext:true},
          ].map(l=>(
            <a key={l.href} href={l.href} target={l.ext?"_blank":undefined} rel={l.ext?"noreferrer":undefined}
              style={{ color:C.textSub, textDecoration:"none", fontSize:"12px", letterSpacing:"1px", transition:"color 0.2s" }} className="footer-link">
              {l.label}
            </a>
          ))}
        </div>
        <div style={{ fontSize:"10px", color:C.textFaint, letterSpacing:"1px" }}>© 2026 Cron.Explain · MIT License</div>
      </footer>
    </div>
  );
}

function landingExtras(C) {
  return `
    .anim-fade-up { animation: fadeUp 0.5s ease both; }
    .anim-fade-up:nth-child(2) { animation-delay: 0.1s; }
    .anim-fade-up:nth-child(3) { animation-delay: 0.2s; }
    .anim-fade-up:nth-child(4) { animation-delay: 0.35s; }
    .hero-cta:hover     { opacity: 0.85; transform: translateY(-2px); box-shadow: 0 8px 24px ${C.accentDim}; }
    .promo-cta:hover    { opacity: 0.85; transform: translateY(-1px); }
    .feature-card:hover { border-color: ${C.border2} !important; }
    .footer-link:hover  { color: ${C.accent} !important; }
    .tool-input-row:focus-within { border-color: ${C.accent} !important; }
    .tool-input::placeholder { color: ${C.border2}; }
    .tool-copy:hover    { border-color: ${C.accent} !important; color: ${C.accent} !important; }
    .tool-ex-btn:hover  { border-color: ${C.border2} !important; }
    @media (max-width: 500px) {
      footer { padding: 40px 16px !important; }
    }
  `;
}
