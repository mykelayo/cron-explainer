// netlify/functions/explain.js
// POST /api/explain
// Body: { "cron": "0 9 * * 1-5" }

// ─── FIELD MATCHER ────────────────────────────────────────────────────────────

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

// ─── NEXT RUNS ────────────────────────────────────────────────────────────────

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

    if (!matchesField(monF, mon, 1)) {
      d.setMonth(d.getMonth() + 1); d.setDate(1); d.setHours(0, 0, 0, 0); continue;
    }
    const domOk = matchesField(domF, dom, 1), dowOk = matchesField(dowF, dow, 0);
    const dayOk = domF === "*" && dowF === "*" ? true
      : domF !== "*" && dowF !== "*" ? (domOk || dowOk)
      : domF !== "*" ? domOk : dowOk;

    if (!dayOk) { d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); continue; }
    if (!matchesField(hourF, hour, 0)) { d.setHours(d.getHours() + 1, 0, 0, 0); continue; }
    if (!matchesField(minF, min, 0)) { d.setMinutes(d.getMinutes() + 1, 0, 0); continue; }

    runs.push(d.toISOString());
    d.setMinutes(d.getMinutes() + 1, 0, 0);
  }
  return runs;
}

// ─── PARSER ───────────────────────────────────────────────────────────────────

function parseField(value, names = []) {
  if (value === "*") return { type: "any", label: "every" };
  if (value.startsWith("*/")) {
    const step = parseInt(value.slice(2));
    return { type: "step", label: `every ${step}`, step };
  }
  if (value.includes("/")) {
    const [range, step] = value.split("/");
    const [start] = range.split("-");
    return { type: "step-from", label: `every ${step} starting at ${names[+start] || start}` };
  }
  if (value.includes("-")) {
    const [a, b] = value.split("-");
    return { type: "range", label: `${names[+a] || a} through ${names[+b] || b}` };
  }
  if (value.includes(",")) {
    const parts = value.split(",").map(v => names[+v] || v);
    const last = parts.pop();
    return { type: "list", label: parts.join(", ") + " and " + last };
  }
  const n = parseInt(value);
  return { type: "specific", label: names[n] !== undefined ? names[n] : value, raw: n };
}

const MONTHS = ["","January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function explainCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { error: "Expression must have exactly 5 fields: minute hour dom month dow" };

  const [minR, hourR, domR, monR, dowR] = parts;

  try {
    const minute = parseField(minR);
    const hour   = parseField(hourR);
    const dom    = parseField(domR);
    const month  = parseField(monR, MONTHS);
    const dow    = parseField(dowR, DAYS);

    let when = "";
    if (minute.type === "any" && hour.type === "any") {
      when = "every minute";
    } else if (minute.type === "step" && hour.type === "any") {
      when = `every ${minute.step} minutes`;
    } else if (hour.type === "specific" && minute.type === "specific") {
      const h = hour.raw, ampm = h >= 12 ? "PM" : "AM", h12 = h % 12 === 0 ? 12 : h % 12;
      when = `at ${h12}:${String(minute.raw).padStart(2, "0")} ${ampm}`;
    } else if (hour.type === "step") {
      when = `every ${hour.step} hours`;
      if (minute.type === "specific") when += ` at minute ${minute.label}`;
    } else {
      when = `at minute ${minute.label}`;
    }

    const hasDom = domR !== "*", hasDow = dowR !== "*";
    const dayDesc = !hasDom && !hasDow ? "every day"
      : hasDom && !hasDow ? `on day ${dom.label} of the month`
      : !hasDom && hasDow ? `on ${dow.label}`
      : `on day ${dom.label} or ${dow.label}`;

    const monthDesc = monR !== "*" ? ` in ${month.label}` : "";
    const explanation = (when.charAt(0).toUpperCase() + when.slice(1)) + `, ${dayDesc}${monthDesc}`;

    return {
      explanation,
      fields: {
        minute:     { raw: minR, parsed: minute.label },
        hour:       { raw: hourR, parsed: hour.label },
        dayOfMonth: { raw: domR, parsed: dom.label },
        month:      { raw: monR, parsed: month.label },
        dayOfWeek:  { raw: dowR, parsed: dow.label },
      }
    };
  } catch (e) {
    return { error: "Failed to parse expression. Check your syntax." };
  }
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  // CORS headers — allow any origin so devs can call this from anywhere
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed. Use POST." }),
    };
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON body." }),
    };
  }

  const { cron } = body;

  if (!cron || typeof cron !== "string") {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required field: cron (string)" }),
    };
  }

  if (cron.trim().split(/\s+/).length !== 5) {
    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({ error: "Invalid cron expression. Must have exactly 5 space-separated fields." }),
    };
  }

  // Run parser
  const result = explainCron(cron);

  if (result.error) {
    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({ error: result.error }),
    };
  }

  // Compute next runs
  const nextRuns = getNextRuns(cron, 5);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      expression: cron.trim(),
      explanation: result.explanation,
      fields: result.fields,
      nextRuns,         // ISO 8601 timestamps (UTC)
    }),
  };
};
