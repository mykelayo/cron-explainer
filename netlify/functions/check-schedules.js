// netlify/functions/check-schedules.js
// Netlify Scheduled Function — runs every 10 minutes automatically.
//
// ─── SWITCH EMAIL PROVIDER HERE ───────────────────────────────────────────────
//   "gmail"  → uses GMAIL_USER + GMAIL_PASS
//   "resend" → uses RESEND_API_KEY + RESEND_FROM
const EMAIL_PROVIDER = "gmail";

"use strict";

exports.config = { schedule: "*/10 * * * *" };

const { getStore, list } = require("@netlify/blobs");

// one place to update the site URL — used in the email footer
const SITE_URL   = "https://cronexplain.netlify.app";
const STORE_NAME = process.env.BLOB_STORE || "cron-jobs";

// ── Cron engine ───────────────────────────────────────────────────────────────

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
    return d;
  }
  return null;
}

function formatTime(date) {
  const DN = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const h = date.getHours(), m = String(date.getMinutes()).padStart(2,"0");
  return `${DN[date.getDay()]}, ${MN[date.getMonth()]} ${date.getDate()} at ${h%12||12}:${m} ${h>=12?"PM":"AM"}`;
}

// strip newlines from job.name before using it in the email subject.
function safeSubjectPart(str) {
  return String(str).replace(/[\r\n]+/g, " ").trim();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL HTML — shared by both providers
// ─────────────────────────────────────────────────────────────────────────────

function buildEmailHtml(job, nextRun) {
  const minsUntil = Math.round((nextRun - Date.now()) / 60000);
  const fireTime  = formatTime(nextRun);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Courier New',monospace;">
<div style="max-width:540px;margin:0 auto;padding:36px 20px;">

  <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:28px;">
    CRON<span style="color:#f0c040">.EXPLAIN</span>
  </div>

  <div style="background:#0f0f0f;border:1px solid #1a1a1a;border-left:3px solid #f0c040;border-radius:6px;padding:24px;">
    <div style="font-size:9px;letter-spacing:3px;color:#f0c040;margin-bottom:10px;">SCHEDULED JOB ALERT</div>
    <div style="font-size:22px;font-weight:700;color:#fff;margin-bottom:6px;">${escHtml(job.name)}</div>
    <div style="font-size:14px;color:#888;margin-bottom:22px;">
      fires in approximately ${minsUntil} minute${minsUntil !== 1 ? "s" : ""}
    </div>

    <div style="background:#141414;border:1px solid #1e1e1e;border-radius:4px;padding:14px;margin-bottom:16px;">
      <div style="font-size:9px;letter-spacing:3px;color:#555;margin-bottom:6px;">EXPRESSION</div>
      <div style="font-size:18px;color:#f0c040;letter-spacing:4px;">${escHtml(job.cron)}</div>
    </div>

    <div style="background:#080e08;border:1px solid #1a2a1a;border-radius:4px;padding:14px;">
      <div style="font-size:9px;letter-spacing:3px;color:#4caf50;margin-bottom:6px;">NEXT RUN</div>
      <div style="font-size:15px;color:#fff;">${fireTime}</div>
    </div>
  </div>

  <div style="margin-top:24px;font-size:11px;color:#333;line-height:1.8;">
    Alert registered at ${SITE_URL}<br>
    To stop alerts: visit <a href="${SITE_URL}/scheduler" style="color:#555;">${SITE_URL}/scheduler</a>
    and delete this job with your management token.
  </div>

</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER: GMAIL
// Needs: GMAIL_USER, GMAIL_PASS (app password)
// Works on: any domain
// ─────────────────────────────────────────────────────────────────────────────

function createGmailTransporter() {
  const nodemailer = require("nodemailer");
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
}

async function sendViaGmail(transporter, job, nextRun) {
  const minsUntil = Math.round((nextRun - Date.now()) / 60000);
  // use safeSubjectPart to prevent header injection via a crafted job name
  const subject = `⏰ "${safeSubjectPart(job.name)}" fires in ${minsUntil}min — ${job.cron}`;

  await transporter.sendMail({
    from:    `"Cron.Explain" <${process.env.GMAIL_USER}>`,
    to:      job.email,
    subject,
    html:    buildEmailHtml(job, nextRun),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER: RESEND
// Needs: RESEND_API_KEY, RESEND_FROM (e.g. alerts@yourdomain.com)
// Works on: custom domains only
// ─────────────────────────────────────────────────────────────────────────────

async function sendViaResend(job, nextRun) {
  const minsUntil = Math.round((nextRun - Date.now()) / 60000);
  // use safeSubjectPart here too
  const subject = `⏰ "${safeSubjectPart(job.name)}" fires in ${minsUntil}min — ${job.cron}`;

  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:    process.env.RESEND_FROM,
      to:      [job.email],
      subject,
      html:    buildEmailHtml(job, nextRun),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend ${res.status}: ${errText}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTER — change EMAIL_PROVIDER at the top of this file to switch providers
// ─────────────────────────────────────────────────────────────────────────────

async function sendAlert(ctx, job, nextRun) {
  if (EMAIL_PROVIDER === "resend") {
    await sendViaResend(job, nextRun);
  } else {
    await sendViaGmail(ctx.gmailTransporter, job, nextRun);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

exports.handler = async function() {
  console.log(`[check-schedules] Running — provider: ${EMAIL_PROVIDER} — ${new Date().toISOString()}`);

  const store = getStore(STORE_NAME);

  // create the Gmail transporter once per invocation, not once per job.
  const ctx = {};
  if (EMAIL_PROVIDER === "gmail") {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      console.error("[check-schedules] GMAIL_USER or GMAIL_PASS not set — emails will fail");
    } else {
      ctx.gmailTransporter = createGmailTransporter();
    }
  }
  if (EMAIL_PROVIDER === "resend" && !process.env.RESEND_API_KEY) {
    console.error("[check-schedules] RESEND_API_KEY not set — emails will fail");
  }

  // List all job blobs
  let jobKeys = [];
  try {
    const result = await list(STORE_NAME, { prefix: "job-" });
    jobKeys = (result.blobs || []).map(b => b.key);
  } catch (err) {
    console.error("[check-schedules] Failed to list blobs:", err.message);
    return { statusCode: 500 };
  }

  if (jobKeys.length === 0) {
    console.log("[check-schedules] No jobs registered.");
    return { statusCode: 200 };
  }

  console.log(`[check-schedules] Checking ${jobKeys.length} jobs`);

  const now            = Date.now();
  const CHECK_INTERVAL = 10 * 60 * 1000; // 10 min in ms
  let   sent           = 0;

  for (const key of jobKeys) {
    try {
      const job = await store.get(key, { type: "json" });
      if (!job) continue;

      const nextRun = getNextRun(job.cron);
      if (!nextRun) continue;

      const msUntil  = nextRun - now;
      const notifyMs = job.notifyMinutes * 60 * 1000;

      // Alert window: nextRun is between (notifyMs ± CHECK_INTERVAL) from now
      const inWindow = msUntil > 0
        && msUntil <= (notifyMs + CHECK_INTERVAL)
        && msUntil >= (notifyMs - CHECK_INTERVAL);
      if (!inWindow) continue;

      // Skip if already alerted for this exact run (within 20 min of fire time)
      if (job.lastAlertSent) {
        const diff = Math.abs(new Date(job.lastAlertSent).getTime() - nextRun.getTime());
        if (diff < 20 * 60 * 1000) {
          console.log(`[check-schedules] Skip ${job.id} — already alerted for this run`);
          continue;
        }
      }

      console.log(`[check-schedules] Alerting ${job.email} — "${job.name}" fires in ${Math.round(msUntil/60000)}m`);
      await sendAlert(ctx, job, nextRun);

      // Record that we sent the alert so we don't send it again
      await store.setJSON(key, {
        ...job,
        lastAlertSent: new Date().toISOString(),
        nextRun:       nextRun.toISOString(),
      });
      sent++;

    } catch (jobErr) {
      // One job failing shouldn't stop the rest from being processed
      console.error(`[check-schedules] Error on ${key}:`, jobErr.message);
    }
  }

  console.log(`[check-schedules] Done. ${sent}/${jobKeys.length} alerts sent via ${EMAIL_PROVIDER}.`);
  return { statusCode: 200 };
};
