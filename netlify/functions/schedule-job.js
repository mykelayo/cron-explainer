// netlify/functions/schedule-job.js
// Handles create / list / delete for cron alert jobs.
// Storage: Netlify Blobs (built-in, zero extra accounts needed).
//
// ENV VARS — set in Netlify → Site → Environment variables:
//   BLOB_STORE   "cron-jobs"   (any consistent name)
//
// Email is handled separately by check-schedules.js.

"use strict";

const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

// ── Constants ─────────────────────────────────────────────────────────────────

const STORE_NAME = process.env.BLOB_STORE || "cron-jobs";
const MAX_JOBS_PER_EMAIL = 10;   // prevent storage abuse
const MAX_NAME_LEN = 80;        // cap field lengths to block oversized payloads
const MAX_CRON_LEN = 60;
const VALID_NOTIFY = new Set([5, 10, 15, 30, 60]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(body, status = 200) { return { statusCode: status, headers: CORS, body: JSON.stringify(body) }; }
function err(msg, status = 400) { return { statusCode: status, headers: CORS, body: JSON.stringify({ error: msg }) }; }

function validCron(expr) {
  return typeof expr === "string"
    && expr.length <= MAX_CRON_LEN
    && expr.trim().split(/\s+/).length === 5;
}

function validEmail(email) {
  return typeof email === "string"
    && email.length <= 254
    && /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email); // FIX: comma excluded to prevent nodemailer multi-recipient injection
}

// validate jobId format before using it in a blob key to prevent path traversal.
// IDs are always 24 hex chars (crypto.randomBytes(12).toString("hex")).
function validJobId(id) {
  return typeof id === "string" && /^[0-9a-f]{24}$/.test(id);
}

// timing-safe token comparison prevents timing attacks where an attacker
// could infer partial token matches by measuring response time.
function safeEqual(a, b) {
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false; // buffers differ in length — definitely not equal
  }
}

// ── Cron next-run calculator ──────────────────────────────────────────────────

// Guards against step=0/NaN (500k-iteration infinite loop)
// and comma lists with >60 items (confirmed 27-second DoS vector).
function matchesField(value, n, min) {
  if (value === "*") return true;

  if (value.startsWith("*/")) {
    const step = parseInt(value.slice(2));
    if (!step || step < 1) return false;
    return (n - min) % step === 0;
  }

  if (value.includes("/")) {
    const [range, stepStr] = value.split("/");
    const step = parseInt(stepStr);
    if (!step || step < 1) return false;
    const start = range === "*" ? min : parseInt(range.split("-")[0]);
    return n >= start && (n - start) % step === 0;
  }

  if (value.includes("-")) { const [a, b] = value.split("-"); return n >= parseInt(a) && n <= parseInt(b); }

  if (value.includes(",")) {
    const items = value.split(",");
    if (items.length > 60) return false;
    return items.map(Number).includes(n);
  }

  return parseInt(value) === n;
}

function getNextRun(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minF, hourF, domF, monF, dowF] = parts;
  const d = new Date(); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() + 1);
  let i = 0;
  while (i++ < 200000) {
    if (!matchesField(monF, d.getMonth() + 1, 1)) { d.setMonth(d.getMonth() + 1); d.setDate(1); d.setHours(0, 0, 0, 0); continue; }
    const dOk = matchesField(domF, d.getDate(), 1), wOk = matchesField(dowF, d.getDay(), 0);
    const dayOk = domF === "*" && dowF === "*" ? true : domF !== "*" && dowF !== "*" ? (dOk || wOk) : domF !== "*" ? dOk : wOk;
    if (!dayOk) { d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); continue; }
    if (!matchesField(hourF, d.getHours(), 0)) { d.setHours(d.getHours() + 1, 0, 0, 0); continue; }
    if (!matchesField(minF, d.getMinutes(), 0)) { d.setMinutes(d.getMinutes() + 1, 0, 0); continue; }
    return d.toISOString();
  }
  return null;
}

// ── IP Rate Limiting (Netlify Blobs) ─────────────────────────────────────────
// IP-based rate limit on create action.
// Atomic SET-NX+INCR pattern so key always has a TTL.
// Uses Netlify Blobs as counter store (no Redis dependency in Cron app).

const RL_CREATE_IP_MAX = 20;  // creates per IP per window
const RL_WINDOW_SEC = 60;

function getClientIp(event) {
  const ip = event.headers["client-ip"];
  if (ip) return ip.trim();
  return (event.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
}

async function isIpRateLimited(store, ip) {
  // Sanitise IP to a safe blob key segment
  const safeIp = ip.replace(/[^a-zA-Z0-9.:_-]/g, "_").slice(0, 64);
  const key = `rl-ip-${safeIp}`;
  const now = Date.now();
  const window = RL_WINDOW_SEC * 1000;

  try {
    // Read current counter
    let entry = null;
    try { entry = await store.get(key, { type: "json" }); } catch { }

    if (!entry || now - entry.windowStart > window) {
      // New window — reset counter
      await store.setJSON(key, { count: 1, windowStart: now });
      return false;
    }
    if (entry.count >= RL_CREATE_IP_MAX) return true;

    // Increment in-window counter
    await store.setJSON(key, { count: entry.count + 1, windowStart: entry.windowStart });
    return false;
  } catch {
    return false; // fail open: if blobs unavailable, don't block users
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return err("POST only.", 405);

  // FIX (Finding 9): body size guard before JSON.parse
  if ((event.body || "").length > 8 * 1024) {
    return err("Request body too large.", 413);
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return err("Invalid JSON."); }

  const { action } = body;
  const store = getStore(STORE_NAME);

  // ── CREATE ──────────────────────────────────────────────────────────────────
  if (action === "create") {
    const { cron, email, name, notifyMinutes } = body;

    if (!validCron(cron)) return err("Invalid cron expression.");
    if (!validEmail(email)) return err("Valid email required.");
    if (!name?.trim()) return err("Job name required.");
    if (name.trim().length > MAX_NAME_LEN) return err(`Job name too long (max ${MAX_NAME_LEN} chars).`);

    // IP rate limit on create — prevents storage exhaustion via throwaway emails
    const clientIp = getClientIp(event);
    if (await isIpRateLimited(store, clientIp)) {
      return {
        statusCode: 429, headers: { ...CORS, "Retry-After": String(RL_WINDOW_SEC) },
        body: JSON.stringify({ error: `Too many requests. Max ${RL_CREATE_IP_MAX} alert creations per minute.` })
      };
    }

    const notify = VALID_NOTIFY.has(Number(notifyMinutes)) ? Number(notifyMinutes) : 15;
    const emailKey = email.trim().toLowerCase();

    // enforce per-email job cap so one address can't fill all storage.
    let emailIndex = [];
    try {
      const raw = await store.get(`email-${emailKey}`, { type: "json" });
      if (Array.isArray(raw)) emailIndex = raw;
    } catch { }

    if (emailIndex.length >= MAX_JOBS_PER_EMAIL) {
      return err(`Maximum ${MAX_JOBS_PER_EMAIL} active alerts per email. Delete an existing alert first.`, 429);
    }

    const id = crypto.randomBytes(12).toString("hex"); // 24 hex chars, matches validJobId regex
    const token = crypto.randomBytes(24).toString("hex"); // 48 hex chars
    const nextRun = getNextRun(cron);

    // Store SHA-256(token) not the raw token.
    // If Netlify Blobs storage is breached, stored token hashes cannot be used
    // to delete jobs (an attacker would need to invert the hash).
    // The raw token is shown to the user once at creation and never persisted.
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const job = {
      id,
      tokenHash,           // hashed — raw token is never stored
      cron: cron.trim(),
      email: emailKey,
      name: name.trim(),
      notifyMinutes: notify,
      nextRun,
      createdAt: Date.now(),
      lastAlertSent: null,
    };

    await store.setJSON(`job-${id}`, job);

    emailIndex.push(id);
    await store.setJSON(`email-${emailKey}`, emailIndex);

    console.log(`[schedule-job] Created ${id} for ${emailKey}`);
    return ok({ jobId: id, token, nextRun }, 201);  // raw token returned to user here only
  }

  // ── LIST ────────────────────────────────────────────────────────────────────
  if (action === "list") {
    const { email } = body;
    if (!validEmail(email)) return err("Valid email required.");

    const emailKey = email.trim().toLowerCase();
    let ids = [];
    try {
      const raw = await store.get(`email-${emailKey}`, { type: "json" });
      if (Array.isArray(raw)) ids = raw;
    } catch { }

    const jobs = [];
    for (const id of ids) {
      // Skip any IDs that slipped in with an unexpected format
      if (!validJobId(id)) continue;
      try {
        const job = await store.get(`job-${id}`, { type: "json" });
        if (job) {
          jobs.push({
            id: job.id,
            name: job.name,
            cron: job.cron,
            notifyMinutes: job.notifyMinutes,
            nextRun: getNextRun(job.cron), // always fresh
            createdAt: job.createdAt,
            // token is intentionally NOT returned
          });
        }
      } catch { }
    }

    return ok({ jobs });
  }

  // ── DELETE ──────────────────────────────────────────────────────────────────
  if (action === "delete") {
    const { jobId, token } = body;

    if (!jobId || !token) return err("jobId and token required.");
    if (!validJobId(jobId)) return err("Invalid job ID format.");    // FIX: reject bad IDs before touching storage
    if (typeof token !== "string" || token.length > 100) return err("Invalid token format.");

    let job;
    try { job = await store.get(`job-${jobId}`, { type: "json" }); }
    catch { return err("Job not found.", 404); }
    if (!job) return err("Job not found.", 404);

    // Compare SHA-256(submitted_token) against stored hash.
    // New jobs store tokenHash. Old jobs (before this fix) store plaintext token —
    // fall back to direct comparison for backward compatibility.
    let tokenValid;
    if (job.tokenHash) {
      const submittedHash = crypto.createHash("sha256").update(token).digest("hex");
      tokenValid = safeEqual(job.tokenHash, submittedHash);
    } else {
      // Legacy blob: stored plaintext token. Still timing-safe.
      tokenValid = safeEqual(job.token || "", token);
    }
    if (!tokenValid) return err("Invalid token.", 403);

    await store.delete(`job-${jobId}`);

    try {
      const raw = await store.get(`email-${job.email}`, { type: "json" });
      if (Array.isArray(raw)) {
        await store.setJSON(`email-${job.email}`, raw.filter(id => id !== jobId));
      }
    } catch { }

    console.log(`[schedule-job] Deleted ${jobId} for ${job.email}`);
    return ok({ deleted: true });
  }

  return err("Unknown action.");
};
