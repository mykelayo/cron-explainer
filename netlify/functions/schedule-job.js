// netlify/functions/schedule-job.js
// Handles: create / list / delete cron alert jobs
// Storage: Upstash Redis via Pipeline API
// Each job stored as: job:{id} = JSON string, with index: jobs:{email} = set of ids
"use strict";
const crypto = require("crypto");

const UPSTASH_URL   = (process.env.UPSTASH_REDIS_REST_URL   || "").trim();
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type":                 "application/json",
};

// ── Upstash Pipeline ──────────────────────────────────────────────────────────
async function upstash(commands) {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body:    JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}: ${await res.text()}`);
  const results = await res.json();
  for (const r of results) if (r.error) throw new Error(`Upstash: ${r.error}`);
  return results;
}

// ── Cron next-run calculator ──────────────────────────────────────────────────
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
  while (i++ < 200000) {
    if (!matchesField(monF, d.getMonth()+1, 1)) { d.setMonth(d.getMonth()+1); d.setDate(1); d.setHours(0,0,0,0); continue; }
    const domOk=matchesField(domF,d.getDate(),1), dowOk=matchesField(dowF,d.getDay(),0);
    const dayOk=domF==="*"&&dowF==="*"?true:domF!=="*"&&dowF!=="*"?(domOk||dowOk):domF!=="*"?domOk:dowOk;
    if (!dayOk) { d.setDate(d.getDate()+1); d.setHours(0,0,0,0); continue; }
    if (!matchesField(hourF, d.getHours(), 0)) { d.setHours(d.getHours()+1,0,0,0); continue; }
    if (!matchesField(minF, d.getMinutes(), 0)) { d.setMinutes(d.getMinutes()+1,0,0); continue; }
    return d.toISOString();
  }
  return null;
}

// ── Validate cron ─────────────────────────────────────────────────────────────
function validateCron(expr) {
  if (typeof expr !== "string") return false;
  const parts = expr.trim().split(/\s+/);
  return parts.length === 5;
}

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "POST only." }) };

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Server not configured." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON." }) }; }

  const { action } = body;

  // ── CREATE ────────────────────────────────────────────────────────────────
  if (action === "create") {
    const { cron, email, name, notifyMinutes } = body;

    if (!validateCron(cron))
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid cron expression." }) };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Valid email required." }) };
    if (!name || typeof name !== "string" || !name.trim())
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Job name required." }) };

    const validNotify = [5, 10, 15, 30, 60];
    const notify = validNotify.includes(Number(notifyMinutes)) ? Number(notifyMinutes) : 15;

    const id    = crypto.randomBytes(12).toString("hex");
    const token = crypto.randomBytes(20).toString("hex"); // management token to delete
    const nextRun = getNextRun(cron);

    const job = JSON.stringify({
      id, token, cron: cron.trim(), email: email.trim().toLowerCase(),
      name: name.trim(), notifyMinutes: notify, nextRun,
      createdAt: Date.now(), lastAlertSent: null,
    });

    // Store job + add to email index
    // job:{id} = job JSON (no expiry — persists until deleted)
    // jobs:{email} = Redis SET of job ids
    await upstash([
      ["SET",  `job:${id}`, job],
      ["SADD", `jobs:${email.trim().toLowerCase()}`, id],
    ]);

    console.log(`[schedule-job] Created job ${id} for ${email}, cron: ${cron}, notify: ${notify}m`);

    return {
      statusCode: 201,
      headers: CORS,
      body: JSON.stringify({ jobId: id, token, nextRun }),
    };
  }

  // ── LIST ──────────────────────────────────────────────────────────────────
  if (action === "list") {
    const { email } = body;
    if (!email) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Email required." }) };

    const emailKey = email.trim().toLowerCase();
    const [membersResult] = await upstash([["SMEMBERS", `jobs:${emailKey}`]]);
    const ids = membersResult.result || [];

    if (ids.length === 0) return { statusCode: 200, headers: CORS, body: JSON.stringify({ jobs: [] }) };

    // Fetch all jobs in one pipeline call
    const gets = ids.map(id => ["GET", `job:${id}`]);
    const results = await upstash(gets);

    const jobs = results
      .map(r => r.result ? JSON.parse(r.result) : null)
      .filter(Boolean)
      .map(j => {
        // Recalculate nextRun in case it's stale
        const nextRun = getNextRun(j.cron);
        return { id: j.id, name: j.name, cron: j.cron, notifyMinutes: j.notifyMinutes, nextRun, createdAt: j.createdAt };
        // Note: token is NOT returned in list — only the creator has it
      });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ jobs }) };
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (action === "delete") {
    const { jobId, token } = body;
    if (!jobId || !token) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "jobId and token required." }) };

    const [getResult] = await upstash([["GET", `job:${jobId}`]]);
    if (!getResult.result) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Job not found." }) };

    const job = JSON.parse(getResult.result);
    if (job.token !== token) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Invalid token." }) };

    await upstash([
      ["DEL",  `job:${jobId}`],
      ["SREM", `jobs:${job.email}`, jobId],
    ]);

    console.log(`[schedule-job] Deleted job ${jobId} for ${job.email}`);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ deleted: true }) };
  }

  return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Unknown action. Use create / list / delete." }) };
};
