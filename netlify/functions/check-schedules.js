// netlify/functions/check-schedules.js
// Runs every 10 minutes via Netlify Scheduled Functions.
// Scans all jobs in Redis, finds ones whose next run is within the alert window,
// sends an email via Resend, and updates lastAlertSent to avoid duplicate sends.
//
// SETUP REQUIRED:
//   1. Add RESEND_API_KEY to Netlify environment variables
//      Get a free key at resend.com (3,000 emails/month free)
//   2. Add RESEND_FROM_EMAIL = "alerts@yourdomain.com" (must be verified in Resend)
//   3. This function is triggered by the schedule below — no HTTP calls needed.

"use strict";

// Netlify Scheduled Function declaration
// Runs every 10 minutes
exports.config = {
  schedule: "*/10 * * * *",
};

const UPSTASH_URL   = (process.env.UPSTASH_REDIS_REST_URL   || "").trim();
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
const RESEND_KEY    = (process.env.RESEND_API_KEY            || "").trim();
const FROM_EMAIL    = (process.env.RESEND_FROM_EMAIL         || "alerts@cronexplain.netlify.app").trim();

// ── Upstash Pipeline ──────────────────────────────────────────────────────────
async function upstash(commands) {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body:    JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const results = await res.json();
  for (const r of results) if (r.error) throw new Error(`Upstash: ${r.error}`);
  return results;
}

// ── Get all job keys ──────────────────────────────────────────────────────────
async function getAllJobIds() {
  // SCAN for all keys matching job:* pattern
  let cursor = "0";
  const ids = [];
  do {
    const [result] = await upstash([["SCAN", cursor, "MATCH", "job:*", "COUNT", "100"]]);
    [cursor] = result.result;
    const keys = result.result[1] || [];
    // Strip "job:" prefix to get ids
    for (const key of keys) ids.push(key.replace(/^job:/, ""));
  } while (cursor !== "0");
  return ids;
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
    return d;
  }
  return null;
}

function formatDateTime(date) {
  const DN=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MN=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const h=date.getHours(), m=String(date.getMinutes()).padStart(2,"0");
  const ampm=h>=12?"PM":"AM", h12=h%12===0?12:h%12;
  return `${DN[date.getDay()]}, ${MN[date.getMonth()]} ${date.getDate()} at ${h12}:${m} ${ampm}`;
}

// ── Send email via Resend ─────────────────────────────────────────────────────
async function sendAlert(job, nextRun) {
  const fireTime = formatDateTime(nextRun);
  const minsUntil = Math.round((nextRun - Date.now()) / 60000);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Courier New',monospace;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">

    <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;margin-bottom:32px;">
      CRON<span style="color:#f0c040">.EXPLAIN</span>
    </div>

    <div style="background:#0f0f0f;border:1px solid #1a1a1a;border-left:3px solid #f0c040;border-radius:6px;padding:28px;">
      <div style="font-size:10px;letter-spacing:3px;color:#f0c040;margin-bottom:12px;">SCHEDULED JOB ALERT</div>
      <div style="font-size:22px;font-weight:700;color:#fff;margin-bottom:8px;">${job.name}</div>
      <div style="font-size:14px;color:#888;margin-bottom:24px;">fires in approximately ${minsUntil} minutes</div>

      <div style="background:#141414;border:1px solid #1e1e1e;border-radius:4px;padding:16px;margin-bottom:20px;">
        <div style="font-size:9px;letter-spacing:3px;color:#444;margin-bottom:8px;">EXPRESSION</div>
        <div style="font-size:18px;color:#f0c040;letter-spacing:4px;">${job.cron}</div>
      </div>

      <div style="background:#080e08;border:1px solid #1a2a1a;border-radius:4px;padding:16px;">
        <div style="font-size:9px;letter-spacing:3px;color:#4caf50;margin-bottom:8px;">NEXT RUN</div>
        <div style="font-size:15px;color:#fff;">${fireTime}</div>
      </div>
    </div>

    <div style="margin-top:28px;font-size:11px;color:#333;line-height:1.8;">
      This alert was registered at cronexplain.netlify.app.<br>
      To stop receiving alerts for this job, visit the Scheduler page and delete it using your management token.
    </div>

    <div style="margin-top:20px;border-top:1px solid #141414;padding-top:16px;font-size:10px;color:#222;letter-spacing:1px;">
      CRON.EXPLAIN · FREE CRON EXPRESSION DECODER<br>
      cronexplain.netlify.app
    </div>
  </div>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      [job.email],
      subject: `⏰ "${job.name}" runs in ${minsUntil} minutes — ${job.cron}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async function() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    console.error("[check-schedules] Missing Upstash env vars.");
    return { statusCode: 500 };
  }
  if (!RESEND_KEY) {
    console.error("[check-schedules] RESEND_API_KEY not set. No emails will be sent.");
    // Don't hard fail — just log. Remove this return if you want it to error loudly.
  }

  console.log("[check-schedules] Running at", new Date().toISOString());

  let jobIds;
  try {
    jobIds = await getAllJobIds();
  } catch (err) {
    console.error("[check-schedules] Failed to scan job keys:", err.message);
    return { statusCode: 500 };
  }

  if (jobIds.length === 0) {
    console.log("[check-schedules] No jobs registered.");
    return { statusCode: 200 };
  }

  // Fetch all jobs
  const gets = jobIds.map(id => ["GET", `job:${id}`]);
  let results;
  try {
    results = await upstash(gets);
  } catch (err) {
    console.error("[check-schedules] Failed to fetch jobs:", err.message);
    return { statusCode: 500 };
  }

  const jobs = results
    .map(r => r.result ? JSON.parse(r.result) : null)
    .filter(Boolean);

  const now = Date.now();
  let alertsSent = 0;

  for (const job of jobs) {
    try {
      const nextRun = getNextRun(job.cron);
      if (!nextRun) continue;

      const msUntilRun  = nextRun - now;
      const notifyMs    = job.notifyMinutes * 60 * 1000;
      const windowMs    = 10 * 60 * 1000; // check runs every 10 min — window is 10 min

      // Should alert if: the run is within the notification window
      // AND we haven't already sent an alert for this run (lastAlertSent is before this window)
      const shouldAlert = msUntilRun > 0
        && msUntilRun <= (notifyMs + windowMs)
        && msUntilRun >= (notifyMs - windowMs);

      if (!shouldAlert) continue;

      // Check we haven't already sent alert for this particular run
      if (job.lastAlertSent) {
        const lastAlert = new Date(job.lastAlertSent);
        const runTime   = new Date(nextRun);
        // If lastAlertSent was within 20 minutes of this run's time, skip (already alerted)
        if (Math.abs(lastAlert - runTime) < 20 * 60 * 1000) {
          console.log(`[check-schedules] Skipping ${job.id} — already alerted for this run`);
          continue;
        }
      }

      console.log(`[check-schedules] Sending alert for job ${job.id} (${job.name}) to ${job.email} — runs in ${Math.round(msUntilRun/60000)}m`);

      if (RESEND_KEY) {
        await sendAlert(job, nextRun);
      } else {
        console.log(`[check-schedules] DRY RUN (no RESEND_API_KEY) — would email ${job.email} about "${job.name}"`);
      }

      // Update lastAlertSent in Redis
      const updatedJob = { ...job, lastAlertSent: new Date().toISOString(), nextRun: nextRun.toISOString() };
      await upstash([["SET", `job:${job.id}`, JSON.stringify(updatedJob)]]);

      alertsSent++;
    } catch (err) {
      console.error(`[check-schedules] Error processing job ${job.id}:`, err.message);
      // Continue to next job — don't let one failure block others
    }
  }

  console.log(`[check-schedules] Done. Checked ${jobs.length} jobs, sent ${alertsSent} alerts.`);
  return { statusCode: 200 };
};
