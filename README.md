# CRON.EXPLAIN

> Stop Googling cron syntax.

A free, no-login cron expression decoder. Paste any cron expression and get a plain-English explanation, a field-by-field breakdown, and the next 5 scheduled run times, live in your browser. Includes an optional email alert Scheduler so you never miss a job firing.

**Live site:** https://cronexplain.netlify.app

---

## Features

- **Live decoder**: instant plain-English explanation as you type, no server involved
- **Field breakdown**: minute, hour, day-of-month, month, day-of-week explained individually
- **Next 5 run times**: calculated in your local timezone
- **REST API**: POST any cron expression, get JSON back
- **Scheduler**: register a job + email, get an alert N minutes before each run
- **Dark / light mode**: persists across pages, refreshes, and open tabs
- **Fully mobile responsive**: works on any screen size
- **No account required**: for anything

---

## Project Structure

```
cron-explain/
├── src/
│   ├── config.js          
│   ├── theme.js          
│   ├── main.jsx          
│   ├── ThemeNav.jsx      
│   ├── Landing.jsx        
│   ├── Docs.jsx           
│   ├── Scheduler.jsx     
│   └── CronTerms.jsx      
│
└── netlify/functions/
    ├── schedule-job.js   
    └── check-schedules.js 
```

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/mykelayo/cron-explain.git
cd cron-explain
npm install
```

### 2. Install backend dependencies

```bash
npm install @netlify/blobs nodemailer
```

### 3. Run locally

```bash
netlify dev
```

The site runs at `http://localhost:8888`. The Netlify CLI proxies function calls automatically.

---

## Deployment (Netlify)

### Step 1 — Connect the repo

Push to GitHub, then in Netlify: **Add new site → Import an existing project** → select your repo.

Build settings:
| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |

### Step 2 — Set environment variables

Go to **Netlify → Site → Environment variables** and add:

| Variable | Value | Used by |
|---|---|---|
| `BLOB_STORE` | `cron-jobs` | Both functions |
| `GMAIL_USER` | `yourname@gmail.com` | check-schedules.js |
| `GMAIL_PASS` | your 16-char app password | check-schedules.js |

> **Gmail App Password** — this is NOT your real Gmail password.
> Get one at: **myaccount.google.com → Security → App passwords**
> Requires 2-step verification to be enabled on your Google account.
> Google displays it as `xxxx xxxx xxxx xxxx` and paste it **without the spaces** into Netlify. No quotes.

### Step 3 — Deploy

Push any commit. Netlify builds and deploys automatically. The scheduled function activates on its own once deployed.

---

## Switching to Resend (when you have a custom domain)

The email provider is controlled by a single line at the top of `check-schedules.js`:

```js
const EMAIL_PROVIDER = "gmail"; // change to "resend" and redeploy
```

Then swap the env vars:

| Remove | Add |
|---|---|
| `GMAIL_USER` | `RESEND_API_KEY` (from resend.com dashboard) |
| `GMAIL_PASS` | `RESEND_FROM` e.g. `alerts@yourdomain.com` |

You'll also need to verify your domain in Resend and add the 3 DNS records they give you (SPF, DKIM, DMARC). Takes about 5–30 minutes to propagate.

---

## API Reference

**Endpoint:** `POST /api/explain`  
**Auth:** None  
**Rate limit:** 60 requests / minute

### Request

```json
{ "cron": "0 9 * * 1-5" }
```

### Response

```json
{
  "cron": "0 9 * * 1-5",
  "explanation": "At 9:00 AM, Monday through Friday",
  "fields": {
    "minute":     { "value": "0",   "meaning": "at minute 0" },
    "hour":       { "value": "9",   "meaning": "at 9" },
    "dayOfMonth": { "value": "*",   "meaning": "every day" },
    "month":      { "value": "*",   "meaning": "every month" },
    "dayOfWeek":  { "value": "1-5", "meaning": "Monday through Friday" }
  },
  "nextRuns": [
    "2026-02-24T09:00:00.000Z",
    "2026-02-25T09:00:00.000Z"
  ]
}
```

### Error responses

| Status | Meaning |
|---|---|
| `400` | Missing or invalid cron expression |
| `405` | Wrong HTTP method (use POST) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## Scheduler

The Scheduler lets anyone register a cron expression and receive an email alert before it fires. No account needed.

**How it works:**
1. User submits a cron expression, email, job name, and how many minutes before to alert
2. Job is stored in Netlify Blobs with a randomly generated management token
3. `check-schedules.js` runs every 10 minutes and checks every registered job
4. When a job's alert window is reached, an email is sent via Gmail or Resend
5. User can delete their alert at any time from `/scheduler` using their token

**Limits:**
- Max 10 active alerts per email address
- Job names: 80 characters max
- Alert timing options: 5m, 10m, 15m, 30m, or 1h before

> ⚠ **Best-effort service.** Alerts may be delayed or missed due to infrastructure outages. Do not rely on this as your sole monitoring mechanism for production systems.

---

## Customising

### Change the domain

Edit `src/config.js` — one file, updates everywhere:

```js
export const SITE_URL    = "https://yourcustomdomain.com";
export const GITHUB_URL  = "https://github.com/you/your-repo";
export const APP_NAME    = "CRON.EXPLAIN";
export const APP_TAGLINE = "Stop Googling cron syntax.";
```

### Change the theme colours

Edit the `DARK` and `LIGHT` objects in `src/theme.js`. Every page reads from these — change once, updates everywhere.

### Change the alert check frequency

In `check-schedules.js`, update the schedule expression and the `CHECK_INTERVAL` constant below it:

```js
exports.config = { schedule: "*/10 * * * *" }; // every 10 minutes
// ...
const CHECK_INTERVAL = 10 * 60 * 1000; // keep in sync with schedule above
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite |
| Routing | React Router |
| Styling | Inline styles + injected CSS (no stylesheet dependency) |
| Hosting | Netlify |
| Functions | Netlify Functions (Node.js) |
| Storage | Netlify Blobs |
| Email | Nodemailer + Gmail SMTP (switchable to Resend) |
| Fonts | IBM Plex Mono, DM Serif Display (Google Fonts) |

---

## License

MIT — free to use, modify, and distribute.

---

Built by a developer, for developers. If this saved you a Google search, consider starring the repo ⭐
