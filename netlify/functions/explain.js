// netlify/functions/explain.js
// POST /api/explain
// Body: { "cron": "0 9 * * 1-5" }
import { getStore } from "@netlify/blobs";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const MAX_CRON_LEN = 100;
const MAX_BODY_BYTES = 4 * 1024; // 4 KB

// Rate limit — 60 requests per IP per minute.
// Uses Netlify Blobs as counter store (same approach as schedule-job.js).
const RL_EXPLAIN_MAX = 60;
const RL_WINDOW_SEC = 60;
const RL_STORE_NAME = process.env.BLOB_STORE || "cron-jobs";

function getClientIp(event) {
  const ip = event.headers["client-ip"];
  if (ip) return ip.trim();
  return (event.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
}

async function isRateLimited(event) {
  const ip = getClientIp(event);
  const safeIp = ip.replace(/[^a-zA-Z0-9.:_-]/g, "_").slice(0, 64);
  const key = `rl-explain-${safeIp}`;
  const now = Date.now();
  const window = RL_WINDOW_SEC * 1000;
  const store = getStore(RL_STORE_NAME);

  try {
    let entry = null;
    try { entry = await store.get(key, { type: "json" }); } catch { }

    if (!entry || now - entry.windowStart > window) {
      await store.setJSON(key, { count: 1, windowStart: now });
      return false;
    }
    if (entry.count >= RL_EXPLAIN_MAX) return true;
    await store.setJSON(key, { count: entry.count + 1, windowStart: entry.windowStart });
    return false;
  } catch {
    return false; // fail open
  }
}

// ─── FIELD MATCHER ────────────────────────────────────────────────────────────
// Added guards against step=0/NaN (which caused 500k-iteration
// loops returning nothing) and comma lists with >60 items (which caused ~27s
// CPU burn, confirmed DoS against the 10s Netlify timeout).

function matchesField(value, n, min) {
  if (value === "*") return true;

  if (value.startsWith("*/")) {
    const step = parseInt(value.slice(2));
    if (!step || step < 1) return false; // guard */0 and */NaN
    return (n - min) % step === 0;
  }

  if (value.includes("/")) {
    const [range, stepStr] = value.split("/");
    const step = parseInt(stepStr);
    if (!step || step < 1) return false; // guard n/0 and n/NaN
    const start = range === "*" ? min : parseInt(range.split("-")[0]);
    return n >= start && (n - start) % step === 0;
  }

  if (value.includes("-")) {
    const [a, b] = value.split("-");
    return n >= parseInt(a) && n <= parseInt(b);
  }

  if (value.includes(",")) {
    const items = value.split(",");
    if (items.length > 60) return false; // guard 1000-item DoS list
    return items.map(Number).includes(n);
  }

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

const MONTHS = ["", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function explainCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { error: "Expression must have exactly 5 fields: minute hour dom month dow" };

  const [minR, hourR, domR, monR, dowR] = parts;

  try {
    const minute = parseField(minR);
    const hour = parseField(hourR);
    const dom = parseField(domR);
    const month = parseField(monR, MONTHS);
    const dow = parseField(dowR, DAYS);

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
        minute: { raw: minR, parsed: minute.label },
        hour: { raw: hourR, parsed: hour.label },
        dayOfMonth: { raw: domR, parsed: dom.label },
        month: { raw: monR, parsed: month.label },
        dayOfWeek: { raw: dowR, parsed: dow.label },
      }
    };
  } catch (e) {
    return { error: "Failed to parse expression. Check your syntax." };
  }
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed. Use POST." }) };
  }

  // body size guard before JSON.parse
  if ((event.body || "").length > MAX_BODY_BYTES) {
    return { statusCode: 413, headers, body: JSON.stringify({ error: "Request body too large." }) };
  }

  // IP rate limit — 60 req/min
  if (await isRateLimited(event)) {
    return {
      statusCode: 429,
      headers: { ...headers, "Retry-After": String(RL_WINDOW_SEC) },
      body: JSON.stringify({ error: `Rate limit exceeded. Max ${RL_EXPLAIN_MAX} requests per minute.` }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const { cron } = body;

  if (!cron || typeof cron !== "string") {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing required field: cron (string)" }) };
  }

  // length gate BEFORE any parsing — blocks the confirmed DoS
  if (cron.length > MAX_CRON_LEN) {
    return {
      statusCode: 400, headers,
      body: JSON.stringify({ error: `cron expression too long (max ${MAX_CRON_LEN} characters).` }),
    };
  }

  if (cron.trim().split(/\s+/).length !== 5) {
    return {
      statusCode: 422, headers,
      body: JSON.stringify({ error: "Invalid cron expression. Must have exactly 5 space-separated fields." }),
    };
  }

  const result = explainCron(cron);
  if (result.error) {
    return { statusCode: 422, headers, body: JSON.stringify({ error: result.error }) };
  }

  const nextRuns = getNextRuns(cron, 5);

  // do not echo the raw user-supplied string back.
  // Return only the parsed/normalised form.
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      explanation: result.explanation,
      fields: result.fields,
      nextRuns,
    }),
  };
};
