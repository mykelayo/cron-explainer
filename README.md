# CRON.EXPLAIN

> Stop Googling cron syntax.

A free, no-login cron expression decoder. Paste any cron expression and get a plain-English explanation, a field-by-field breakdown, and the next 5 scheduled run times, live in your browser. Includes an optional email alert Scheduler so you never miss a job firing.

**Live site:** https://cronexplain.netlify.app  
**License:** MIT

---

## Features

- **Live decoder.** Instant plain-English explanation as you type, no server involved.
- **Field breakdown.** Minute, hour, day-of-month, month, day-of-week explained individually.
- **Next 5 run times.** Calculated in your local timezone.
- **REST API.** POST any cron expression, get JSON back. 60 requests per minute, no auth needed.
- **Scheduler.** Register a job and email, get an alert N minutes before each run.
- **Dark and light mode.** Persists across pages, refreshes, and open tabs. Syncs instantly across every component on the page without requiring a reload. Respects OS preference on first visit.
- **15-language translation.** Globe button in the nav, powered by Google Translate. Driven by a custom-styled picker so the default Google widget is never visible.
- **Clipboard fallback.** Copy buttons work even where `navigator.clipboard` is unavailable, such as on HTTP or some mobile browsers.
- **Fully mobile responsive.** Works on any screen size. Nav collapses to a hamburger at 640px.
- **No account required.** For anything.

---

## Project Structure

```
cron-explain/
├── index.html                  
├── netlify.toml                
│
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
    ├── explain.js              
    ├── schedule-job.js         
    └── check-schedules.js    
```

---

## Customising (start here)

### Change the domain or branding

Edit `src/config.js`. One file, propagates to every page and component:

```js
export const SITE_URL       = "https://cronexplain.netlify.app";
export const GITHUB_URL     = "https://github.com/mykelayo/cron-explainer";
export const APP_NAME       = "CRON.EXPLAIN";
export const APP_TAGLINE    = "Stop Googling cron syntax.";
export const AUTHOR         = "mykelayo";
export const TWITTER        = "@th3400l";
export const COPYRIGHT_YEAR = "2026";
```

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/mykelayo/cron-explainer.git
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

The site runs at `http://localhost:8888`. The Netlify CLI proxies `/api/*` calls to the functions automatically. Do not use `npm run dev` alone as Vite cannot proxy function routes.

---

## Deployment (Netlify)

### Step 1. Connect the repo

Push to GitHub, then in Netlify: **Add new site → Import an existing project** → select your repo.

Build settings are auto-detected from `netlify.toml`:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |

### Step 2. Set environment variables

Go to **Netlify → Site → Environment variables** and add:

| Variable | Value | Used by |
|---|---|---|
| `BLOB_STORE` | `cron-jobs` | Both functions |
| `GMAIL_USER` | `yourname@gmail.com` | check-schedules.js |
| `GMAIL_PASS` | Your 16-character app password | check-schedules.js |

**Gmail App Password.** This is not your real Gmail password. Get one at **myaccount.google.com → Security → App passwords**. Requires 2-step verification. Google displays it as `xxxx xxxx xxxx xxxx`. Paste it without the spaces and without quotes.

### Step 3. Deploy

Push any commit. Netlify builds and deploys automatically. The scheduled function activates on its own once deployed.

---

## Switching Email Providers (Gmail to Resend)

The email provider is controlled by a single line at the top of `check-schedules.js`:

```js
const EMAIL_PROVIDER = "gmail"; // change to "resend" and redeploy
```

Then swap the environment variables:

| Remove | Add |
|---|---|
| `GMAIL_USER` | `RESEND_API_KEY` (from resend.com dashboard) |
| `GMAIL_PASS` | `RESEND_FROM`, e.g. `alerts@yourdomain.com` |

Resend requires a verified custom domain. Add the 3 DNS records they provide (SPF, DKIM, DMARC). Propagation takes 5 to 30 minutes.

---

## Security

Security headers are applied to every response via `netlify.toml`:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy` with explicit allowlists for scripts, styles, fonts, and Google Translate domains

The CSP includes the domains required by Google Translate (`translate.google.com`, `translate.googleapis.com`) so the language picker works correctly in production. If you add Google Analytics or AdSense later, see the comments in `netlify.toml` for the additional domains to whitelist.

---

## API Reference

**Endpoint:** `POST /api/explain`  
**Auth:** None  
**Rate limit:** 60 requests per minute

### Request

```json
{ "cron": "0 9 * * 1-5" }
```

### Response `200`

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
| `405` | Wrong HTTP method. Use POST. |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## Scheduler

The Scheduler lets anyone register a cron expression and receive an email alert before it fires. No account needed.

**How it works:**

1. User submits a cron expression, email address, job name, and how many minutes before to alert.
2. Job is stored in Netlify Blobs with a randomly generated management token.
3. `check-schedules.js` runs every 10 minutes and checks every registered job.
4. When a job's alert window is reached, an email is sent via Gmail or Resend.
5. User can delete their alert at any time from `/scheduler` using their token.

**Limits:**

- Max 10 active alerts per email address.
- Job names: 80 characters max.
- Alert timing options: 5m, 10m, 15m, 30m, or 1 hour before.

> Best-effort service. Alerts may be delayed or missed due to infrastructure outages. Do not rely on this as your sole monitoring mechanism for production systems.

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
| Translation | Google Translate Element, hidden, driven by custom UI in ThemeNav.jsx |
| Fonts | IBM Plex Mono, DM Serif Display (Google Fonts) |

---

Built by a developer, for developers. If this saved you a Google search, consider starring the repo.
