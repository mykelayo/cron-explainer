import { useState, useEffect } from "react";

// ─── CRON PARSER ────────────────────────────────────────────────────────────

function parseField(value, min, max, names = []) {
  if (value === "*") return { type: "any", label: "every" };
  if (value.startsWith("*/")) {
    const step = parseInt(value.slice(2));
    return { type: "step", label: `every ${step}`, step };
  }
  if (value.includes("/")) {
    const [range, step] = value.split("/");
    const [start] = range.split("-");
    return { type: "step-from", label: `every ${step} starting at ${names[+start] || start}`, step, start };
  }
  if (value.includes("-")) {
    const [a, b] = value.split("-");
    const la = names[+a] || a;
    const lb = names[+b] || b;
    return { type: "range", label: `${la} through ${lb}` };
  }
  if (value.includes(",")) {
    const parts = value.split(",").map(v => names[+v] || v);
    const last = parts.pop();
    return { type: "list", label: parts.join(", ") + " and " + last };
  }
  const n = parseInt(value);
  return { type: "specific", label: names[n] !== undefined ? names[n] : value, raw: n };
}

const MONTHS = ["", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function explainCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { error: "A cron expression needs exactly 5 fields." };

  const [minuteRaw, hourRaw, domRaw, monthRaw, dowRaw] = parts;

  try {
    const minute = parseField(minuteRaw, 0, 59);
    const hour = parseField(hourRaw, 0, 23);
    const dom = parseField(domRaw, 1, 31);
    const month = parseField(monthRaw, 1, 12, MONTHS);
    const dow = parseField(dowRaw, 0, 6, DAYS);

    // Build human sentence
    let when = "";

    // Time
    if (minute.type === "any" && hour.type === "any") {
      when = "every minute";
    } else if (minute.type === "step" && hour.type === "any") {
      when = `every ${minute.step} minutes`;
    } else if (minute.type === "any" && hour.type !== "any") {
      when = `every minute of ${describeHour(hourRaw)}`;
    } else if (hour.type === "specific" && minute.type === "specific") {
      const h = hour.raw;
      const m = minute.raw;
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      const mStr = String(m).padStart(2, "0");
      when = `at ${h12}:${mStr} ${ampm}`;
    } else if (hour.type === "step") {
      when = `every ${hour.step} hours`;
      if (minute.type === "specific") when += ` at minute ${minute.label}`;
    } else {
      when = `at minute ${minute.label} of ${describeHour(hourRaw)}`;
    }

    // Day
    let dayDesc = "";
    const hasDom = domRaw !== "*";
    const hasDow = dowRaw !== "*";

    if (!hasDom && !hasDow) {
      dayDesc = "every day";
    } else if (hasDom && !hasDow) {
      dayDesc = `on day ${dom.label} of the month`;
    } else if (!hasDom && hasDow) {
      dayDesc = `on ${dow.label}`;
    } else {
      dayDesc = `on day ${dom.label} of the month or on ${dow.label}`;
    }

    // Month
    let monthDesc = "";
    if (monthRaw !== "*") {
      monthDesc = ` in ${month.label}`;
    }

    const sentence = capitalizeFirst(`${when}, ${dayDesc}${monthDesc}`);

    return {
      sentence,
      fields: [
        { name: "Minute", value: minuteRaw, parsed: minute },
        { name: "Hour", value: hourRaw, parsed: hour },
        { name: "Day of Month", value: domRaw, parsed: dom },
        { name: "Month", value: monthRaw, parsed: month },
        { name: "Day of Week", value: dowRaw, parsed: dow },
      ]
    };
  } catch (e) {
    return { error: "Could not parse this expression. Check the syntax." };
  }
}

function describeHour(raw) {
  const p = parseField(raw, 0, 23);
  if (p.type === "specific") {
    const h = p.raw;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:00 ${ampm}`;
  }
  return `hour ${p.label}`;
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── EXAMPLES ───────────────────────────────────────────────────────────────

const EXAMPLES = [
  { expr: "0 9 * * 1-5", label: "Weekday mornings" },
  { expr: "*/15 * * * *", label: "Every 15 mins" },
  { expr: "0 0 1 * *", label: "Monthly reset" },
  { expr: "30 18 * * 5", label: "Friday evening" },
  { expr: "0 */6 * * *", label: "Every 6 hours" },
  { expr: "0 0 * * 0", label: "Weekly on Sunday" },
];

// ─── APP ─────────────────────────────────────────────────────────────────────

export default function CronExplainer() {
  const [input, setInput] = useState("0 9 * * 1-5");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (input.trim()) {
      setResult(explainCron(input));
    } else {
      setResult(null);
    }
  }, [input]);

  function copyResult() {
    if (result?.sentence) {
      navigator.clipboard.writeText(result.sentence);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const parts = input.trim().split(/\s+/);
  const fieldLabels = ["MIN", "HOUR", "DOM", "MON", "DOW"];

  return (
    <div style={styles.root}>
      <style>{css}</style>

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.badge}>DEV TOOL</div>
        <h1 style={styles.title}>
          CRON<span style={styles.titleAccent}>.EXPLAIN</span>
        </h1>
        <p style={styles.subtitle}>Paste any cron expression. Get plain English, instantly.</p>
      </header>

      {/* Input area */}
      <div style={styles.inputCard} className="input-card">
        <div style={styles.fieldLabels}>
          {fieldLabels.map((label, i) => (
            <div key={i} style={{
              ...styles.fieldLabel,
              color: parts[i] && parts[i] !== "*" ? "#f0c040" : "#444"
            }}>{label}</div>
          ))}
        </div>

        <div style={styles.inputRow}>
          <span style={styles.prompt}>$</span>
          <input
            style={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            spellCheck={false}
            placeholder="* * * * *"
            className="cron-input"
          />
        </div>
      </div>

      {/* Result */}
      <div style={styles.resultArea}>
        {result?.error && (
          <div style={styles.errorBox} className="fade-in">
            <span style={styles.errorIcon}>!</span>
            <span>{result.error}</span>
          </div>
        )}

        {result?.sentence && (
          <div style={styles.sentenceBox} className="fade-in">
            <div style={styles.sentenceLabel}>RUNS</div>
            <div style={styles.sentence}>{result.sentence}</div>
            <button style={{...styles.copyBtn, ...(copied ? styles.copiedBtn : {})}} onClick={copyResult} className="copy-btn">
              {copied ? "✓ COPIED" : "COPY"}
            </button>
          </div>
        )}

        {/* Field breakdown */}
        {result?.fields && (
          <div style={styles.fields} className="fade-in">
            {result.fields.map((f, i) => (
              <div key={i} style={styles.fieldRow} className="field-row">
                <div style={styles.fieldName}>{f.name}</div>
                <div style={styles.fieldValue}>{f.value}</div>
                <div style={styles.fieldArrow}>→</div>
                <div style={styles.fieldParsed}>{f.parsed.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Examples */}
      <div style={styles.examplesSection}>
        <div style={styles.examplesLabel}>QUICK EXAMPLES</div>
        <div style={styles.examples}>
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              style={styles.exampleBtn}
              className="example-btn"
              onClick={() => setInput(ex.expr)}
            >
              <span style={styles.exampleExpr}>{ex.expr}</span>
              <span style={styles.exampleLabel}>{ex.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Field reference */}
      <div style={styles.reference}>
        <div style={styles.refTitle}>FIELD ORDER</div>
        <div style={styles.refRow}>
          {["minute (0–59)", "hour (0–23)", "day of month (1–31)", "month (1–12)", "day of week (0–6, Sun=0)"].map((f, i) => (
            <div key={i} style={styles.refItem}>
              <span style={styles.refNum}>{i + 1}</span>
              <span style={styles.refText}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = {
  root: {
    background: "#0d0d0d",
    minHeight: "100vh",
    fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
    color: "#e0e0e0",
    padding: "0 0 60px 0",
    position: "relative",
    overflow: "hidden",
  },
  header: {
    textAlign: "center",
    padding: "60px 20px 40px",
    borderBottom: "1px solid #1e1e1e",
  },
  badge: {
    display: "inline-block",
    fontSize: "10px",
    letterSpacing: "4px",
    color: "#f0c040",
    border: "1px solid #f0c040",
    padding: "3px 10px",
    marginBottom: "20px",
  },
  title: {
    fontSize: "clamp(40px, 8vw, 72px)",
    fontWeight: "800",
    margin: "0 0 12px 0",
    letterSpacing: "-2px",
    color: "#ffffff",
    fontFamily: "'IBM Plex Mono', monospace",
  },
  titleAccent: {
    color: "#f0c040",
  },
  subtitle: {
    fontSize: "14px",
    color: "#666",
    letterSpacing: "1px",
    margin: 0,
  },
  inputCard: {
    maxWidth: "680px",
    margin: "40px auto 0",
    padding: "0 20px",
  },
  fieldLabels: {
    display: "flex",
    gap: "0",
    marginBottom: "8px",
    paddingLeft: "28px",
  },
  fieldLabel: {
    flex: 1,
    fontSize: "10px",
    letterSpacing: "2px",
    textAlign: "center",
    transition: "color 0.2s",
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    background: "#111",
    border: "1px solid #2a2a2a",
    borderRadius: "4px",
    padding: "16px 20px",
    gap: "14px",
    transition: "border-color 0.2s",
  },
  prompt: {
    color: "#f0c040",
    fontSize: "20px",
    fontWeight: "bold",
    userSelect: "none",
  },
  input: {
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#ffffff",
    fontSize: "clamp(20px, 4vw, 32px)",
    fontFamily: "inherit",
    letterSpacing: "8px",
    width: "100%",
    caretColor: "#f0c040",
  },
  resultArea: {
    maxWidth: "680px",
    margin: "24px auto 0",
    padding: "0 20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  sentenceBox: {
    background: "#111",
    border: "1px solid #2a2a2a",
    borderLeft: "3px solid #f0c040",
    borderRadius: "4px",
    padding: "20px 24px",
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
  },
  sentenceLabel: {
    fontSize: "10px",
    letterSpacing: "3px",
    color: "#f0c040",
    marginTop: "4px",
    flexShrink: 0,
  },
  sentence: {
    fontSize: "clamp(15px, 2.5vw, 18px)",
    color: "#ffffff",
    lineHeight: "1.5",
    flex: 1,
    minWidth: "200px",
  },
  copyBtn: {
    background: "transparent",
    border: "1px solid #333",
    color: "#666",
    fontFamily: "inherit",
    fontSize: "10px",
    letterSpacing: "2px",
    padding: "6px 12px",
    cursor: "pointer",
    borderRadius: "2px",
    transition: "all 0.2s",
    flexShrink: 0,
    marginTop: "2px",
  },
  copiedBtn: {
    borderColor: "#f0c040",
    color: "#f0c040",
  },
  errorBox: {
    background: "#160a0a",
    border: "1px solid #3a1010",
    borderLeft: "3px solid #cc3333",
    borderRadius: "4px",
    padding: "16px 20px",
    display: "flex",
    gap: "12px",
    alignItems: "center",
    color: "#cc5555",
    fontSize: "14px",
  },
  errorIcon: {
    width: "20px",
    height: "20px",
    border: "1px solid #cc3333",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    textAlign: "center",
    lineHeight: "20px",
    fontSize: "12px",
  },
  fields: {
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: "4px",
    overflow: "hidden",
  },
  fieldRow: {
    display: "flex",
    alignItems: "center",
    padding: "12px 20px",
    borderBottom: "1px solid #1a1a1a",
    gap: "16px",
    fontSize: "13px",
    transition: "background 0.15s",
  },
  fieldName: {
    color: "#555",
    width: "110px",
    flexShrink: 0,
    fontSize: "11px",
    letterSpacing: "1px",
  },
  fieldValue: {
    color: "#f0c040",
    width: "60px",
    flexShrink: 0,
    fontWeight: "bold",
  },
  fieldArrow: {
    color: "#333",
    flexShrink: 0,
  },
  fieldParsed: {
    color: "#ccc",
    flex: 1,
  },
  examplesSection: {
    maxWidth: "680px",
    margin: "40px auto 0",
    padding: "0 20px",
  },
  examplesLabel: {
    fontSize: "10px",
    letterSpacing: "3px",
    color: "#444",
    marginBottom: "14px",
  },
  examples: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "8px",
  },
  exampleBtn: {
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: "4px",
    padding: "12px 16px",
    cursor: "pointer",
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    transition: "all 0.15s",
    fontFamily: "inherit",
  },
  exampleExpr: {
    color: "#f0c040",
    fontSize: "13px",
    letterSpacing: "2px",
  },
  exampleLabel: {
    color: "#555",
    fontSize: "11px",
    letterSpacing: "1px",
  },
  reference: {
    maxWidth: "680px",
    margin: "40px auto 0",
    padding: "0 20px",
  },
  refTitle: {
    fontSize: "10px",
    letterSpacing: "3px",
    color: "#444",
    marginBottom: "12px",
  },
  refRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  refItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: "3px",
    padding: "8px 12px",
    fontSize: "12px",
  },
  refNum: {
    color: "#f0c040",
    fontWeight: "bold",
    fontSize: "11px",
  },
  refText: {
    color: "#555",
  },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700;800&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: #0d0d0d; }

  .cron-input::placeholder { color: #333; letter-spacing: 8px; }
  .cron-input:focus { outline: none; }
  .input-card:focus-within .inputRow { border-color: #f0c040 !important; }

  .copy-btn:hover { border-color: #f0c040 !important; color: #f0c040 !important; }

  .example-btn:hover {
    border-color: #2a2a2a !important;
    background: #161616 !important;
    transform: translateY(-1px);
  }

  .field-row:last-child { border-bottom: none !important; }
  .field-row:hover { background: #161616; }

  .fade-in {
    animation: fadeUp 0.25s ease forwards;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  ::selection { background: #f0c04030; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #0d0d0d; }
  ::-webkit-scrollbar-thumb { background: #2a2a2a; }
`;
