// netlify/functions/schedule-job.js
// Handles create / list / delete for cron alert jobs.
// Storage: Netlify Blobs (built-in).

"use strict";

const crypto    = require("crypto");
const { getStore } = require("@netlify/blobs");

// ── Constants ─────────────────────────────────────────────────────────────────

const STORE_NAME    = process.env.BLOB_STORE || "cron-jobs";
const MAX_JOBS_PER_EMAIL = 10;   // prevent storage abuse
const MAX_NAME_LEN  = 80;        // cap field lengths to block oversized payloads
const MAX_CRON_LEN  = 60;
const VALID_NOTIFY  = new Set([5, 10, 15, 30, 60]);

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type":                 "application/json",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(body, status = 200)  { return { statusCode: status, headers: CORS, body: JSON.stringify(body) }; }
function err(msg, status = 400)  { return { statusCode: status, headers: CORS, body: JSON.stringify({ error: msg }) }; }

function validCron(expr) {
  return typeof expr === "string"
    && expr.length <= MAX_CRON_LEN
    && expr.trim().split(/\s+/).length === 5;
}

function validEmail(email) {
  return typeof email === "string"
    && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
  const [minF, hourF, domF, monF, dowF] = parts;
  const d = new Date(); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() + 1);
  let i = 0;
  while (i++ < 200000) {
    if (!matchesField(monF, d.getMonth()+1, 1)) { d.setMonth(d.getMonth()+1); d.setDate(1); d.setHours(0,0,0,0); continue; }
    const dOk = matchesField(domF, d.getDate(), 1), wOk = matchesField(dowF, d.getDay(), 0);
    const dayOk = domF==="*"&&dowF==="*" ? true : domF!=="*"&&dowF!=="*" ? (dOk||wOk) : domF!=="*" ? dOk : wOk;
    if (!dayOk) { d.setDate(d.getDate()+1); d.setHours(0,0,0,0); continue; }
    if (!matchesField(hourF, d.getHours(), 0)) { d.setHours(d.getHours()+1,0,0,0); continue; }
    if (!matchesField(minF,  d.getMinutes(), 0)) { d.setMinutes(d.getMinutes()+1,0,0); continue; }
    return d.toISOString();
  }
  return null;
}

// ── Main handler ──────────────────────────────────────────────────────────────

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST")    return err("POST only.", 405);

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return err("Invalid JSON."); }

  const { action } = body;
  const store = getStore(STORE_NAME);

  // ── CREATE ──────────────────────────────────────────────────────────────────
  if (action === "create") {
    const { cron, email, name, notifyMinutes } = body;

    if (!validCron(cron))   return err("Invalid cron expression.");
    if (!validEmail(email)) return err("Valid email required.");
    if (!name?.trim())      return err("Job name required.");
    if (name.trim().length > MAX_NAME_LEN) return err(`Job name too long (max ${MAX_NAME_LEN} chars).`);

    const notify   = VALID_NOTIFY.has(Number(notifyMinutes)) ? Number(notifyMinutes) : 15;
    const emailKey = email.trim().toLowerCase();

    // enforce per-email job cap so one address can't fill all storage.
    let emailIndex = [];
    try {
      const raw = await store.get(`email-${emailKey}`, { type: "json" });
      if (Array.isArray(raw)) emailIndex = raw;
    } catch {}

    if (emailIndex.length >= MAX_JOBS_PER_EMAIL) {
      return err(`Maximum ${MAX_JOBS_PER_EMAIL} active alerts per email. Delete an existing alert first.`, 429);
    }

    const id      = crypto.randomBytes(12).toString("hex"); // 24 hex chars, matches validJobId regex
    const token   = crypto.randomBytes(24).toString("hex"); // 48 hex chars
    const nextRun = getNextRun(cron);

    const job = {
      id,
      token,
      cron:          cron.trim(),
      email:         emailKey,
      name:          name.trim(),
      notifyMinutes: notify,
      nextRun,
      createdAt:     Date.now(),
      lastAlertSent: null,
    };

    await store.setJSON(`job-${id}`, job);

    emailIndex.push(id);
    await store.setJSON(`email-${emailKey}`, emailIndex);

    console.log(`[schedule-job] Created ${id} for ${emailKey}`);
    return ok({ jobId: id, token, nextRun }, 201);
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
    } catch {}

    const jobs = [];
    for (const id of ids) {
      // Skip any IDs that slipped in with an unexpected format
      if (!validJobId(id)) continue;
      try {
        const job = await store.get(`job-${id}`, { type: "json" });
        if (job) {
          jobs.push({
            id:            job.id,
            name:          job.name,
            cron:          job.cron,
            notifyMinutes: job.notifyMinutes,
            nextRun:       getNextRun(job.cron), // always fresh
            createdAt:     job.createdAt,
            // token is intentionally NOT returned
          });
        }
      } catch {}
    }

    return ok({ jobs });
  }

  // ── DELETE ──────────────────────────────────────────────────────────────────
  if (action === "delete") {
    const { jobId, token } = body;

    if (!jobId || !token)      return err("jobId and token required.");
    if (!validJobId(jobId))    return err("Invalid job ID format.");    // reject bad IDs before touching storage
    if (typeof token !== "string" || token.length > 100) return err("Invalid token format.");

    let job;
    try { job = await store.get(`job-${jobId}`, { type: "json" }); }
    catch { return err("Job not found.", 404); }
    if (!job) return err("Job not found.", 404);

    // timing-safe comparison instead of !==
    if (!safeEqual(job.token, token)) return err("Invalid token.", 403);

    await store.delete(`job-${jobId}`);

    try {
      const raw = await store.get(`email-${job.email}`, { type: "json" });
      if (Array.isArray(raw)) {
        await store.setJSON(`email-${job.email}`, raw.filter(id => id !== jobId));
      }
    } catch {}

    console.log(`[schedule-job] Deleted ${jobId} for ${job.email}`);
    return ok({ deleted: true });
  }

  return err("Unknown action.");
};
