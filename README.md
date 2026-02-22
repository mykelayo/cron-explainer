# CRON.EXPLAIN

> Stop Googling cron syntax. Paste any cron expression and instantly get a plain-English explanation, a field-by-field breakdown, and the next 5 scheduled run times.

🔗 **Live app:** [https://timely-flan-0ca3c1.netlify.app](https://timely-flan-0ca3c1.netlify.app)

---

## What it does

Cron.Explain takes any standard 5-field cron expression and gives you three things immediately:

- **Plain English explanation** — e.g. `0 9 * * 1-5` → *"At 9:00 AM, on Monday through Friday"*
- **Field-by-field breakdown** — exactly what each of the 5 fields means
- **Next 5 run times** — the actual dates and times your job will fire next, in your local timezone

No account. No install. Runs entirely in the browser. Also available as a free REST API.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Styling | Inline JS styles + IBM Plex Mono |
| Deployment | Netlify |
| API | Netlify Functions (serverless) |
| Dependencies | Zero — no external cron libraries |

Everything is built from scratch. The cron parser, the next-run calculator, and the UI are all custom, dependency-free code.

---

## Project Structure

```
cron-explainer/
├── netlify/
│   └── functions/
│       └── explain.js      # Serverless API handler
├── src/
│   ├── main.jsx            # Entry point
│   ├── Landing.jsx         # Landing page + embedded tool
│   ├── Docs.jsx            # API Documentation
│   └── App.jsx             # Standalone tool (legacy)
├── netlify.toml            # Redirects /api/* → /.netlify/functions/*
├── index.html
└── package.json
```

---

## Running Locally

```bash
# Clone the repo
git clone https://github.com/mykelayo/cron-explainer.git
git clone https://github.com/mykelayo/cron-explainer.git
cd cron-explainer

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

To test the API function locally, install the Netlify CLI:

```bash
npm install -g netlify-cli
netlify dev
```

Then hit `http://localhost:8888/api/explain` with a POST request.

---

## API

A free, open REST API. No key required.

**Endpoint:**
```
POST https://timely-flan-0ca3c1.netlify.app/api/explain
```

**Request:**
```json
{
  "cron": "0 9 * * 1-5"
}
```

**Response:**
```json
{
  "expression": "0 9 * * 1-5",
  "explanation": "At 9:00 AM, on Monday through Friday",
  "fields": {
    "minute":     { "raw": "0",   "parsed": "0" },
    "hour":       { "raw": "9",   "parsed": "9" },
    "dayOfMonth": { "raw": "*",   "parsed": "every" },
    "month":      { "raw": "*",   "parsed": "every" },
    "dayOfWeek":  { "raw": "1-5", "parsed": "Monday through Friday" }
  },
  "nextRuns": [
    "2026-02-23T09:00:00.000Z",
    "2026-02-24T09:00:00.000Z",
    "2026-02-25T09:00:00.000Z",
    "2026-02-26T09:00:00.000Z",
    "2026-02-27T09:00:00.000Z"
  ]
}
```

Full API documentation: [https://timely-flan-0ca3c1.netlify.app/docs](https://timely-flan-0ca3c1.netlify.app/docs)

---

## Quick Examples

| Expression | Meaning |
|---|---|
| `* * * * *` | Every minute |
| `0 9 * * 1-5` | At 9:00 AM, Monday–Friday |
| `*/15 * * * *` | Every 15 minutes |
| `0 0 1 * *` | At midnight on the 1st of every month |
| `30 18 * * 5` | At 6:30 PM every Friday |
| `0 */6 * * *` | Every 6 hours |
| `0 0 * * 0` | At midnight every Sunday |

---

## Cron Field Reference

```
┌──────────── minute (0–59)
│ ┌────────── hour (0–23)
│ │ ┌──────── day of month (1–31)
│ │ │ ┌────── month (1–12)
│ │ │ │ ┌──── day of week (0–6, Sunday = 0)
│ │ │ │ │
* * * * *
```

**Special characters:**

| Character | Meaning | Example |
|---|---|---|
| `*` | Any value | `* * * * *` — every minute |
| `*/n` | Every n units | `*/15 * * * *` — every 15 minutes |
| `n-m` | Range | `1-5` — Monday through Friday |
| `n,m` | List | `1,3,5` — Monday, Wednesday, Friday |
| `n/m` | Step from n | `0/12` — every 12 hours starting at midnight |

---

## Deploying Your Own

1. Fork this repo
2. Connect to [Netlify](https://netlify.com) via GitHub
3. Deploy — no build configuration needed, Netlify auto-detects Vite

---

## Contributing

Pull requests are welcome. For major changes, open an issue first.

1. Fork the repo
2. Create your branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a pull request

---

## License

MIT — free to use, modify, and distribute.

---

Built by a developer, for developers. If this saved you a Google search, consider starring the repo ⭐
