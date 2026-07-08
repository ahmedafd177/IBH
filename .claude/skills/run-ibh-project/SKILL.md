---
name: run-ibh-project
description: Build, start, smoke-test, and screenshot the IBH (Inspiring Beauty Hub) storefront + admin dashboard. Use when asked to run IBH, start the server, take a screenshot of the store/admin UI, hit its API with curl, or verify a change actually works in the browser.
---

IBH is a single Express app (`server.js`) that serves a static
storefront (assembled from `partials/*.html` into `index.html` by
`build.js`), a separate admin dashboard at `/ibh-manage`, and a REST
API under `/api/*`, all backed by Supabase Postgres. Drive it with
`.claude/skills/run-ibh-project/driver.sh` — it wraps the
background-launch/readiness-poll pattern, `curl` smoke checks,
`google-chrome --headless` screenshots (no `chromium-cli` in this
environment), and a helper that mints a real admin session token
directly in the database for hitting `requireAuth`-gated routes.

All paths below are relative to the project root (`IBH-project/`, the
directory containing `package.json`).

## Prerequisites

- Node.js (already on PATH; no extra apt packages were needed).
- `google-chrome` for screenshots — already present at `/usr/bin/google-chrome`
  in this environment. If missing: `sudo apt-get install -y google-chrome-stable`
  (or use whatever Chromium/Chrome binary is available and pass it instead).
- A `.env` file in the project root with at least `DATABASE_URL` (Supabase
  Postgres pooled connection string) — the app throws immediately on boot
  without it (`database/db.js`). This is a real Supabase project already
  configured for this repo; there is no local/sqlite fallback anymore.

## Setup

Dependencies are already installed under `node_modules/`. If starting from a
fresh clone:

```bash
npm install
```

No build step is required before running — `server.js` calls
`buildIndex()` itself on every request (and on startup via `fs.watch` on
`partials/`), so `index.html` is always regenerated from the partials.
`npm run build` only matters if you want a static `index.html` written to
disk for inspection outside the running server.

## Run (agent path)

```bash
.claude/skills/run-ibh-project/driver.sh start
```

This launches `node server.js` in the background, logs to
`/tmp/ibh-server.log`, polls `http://localhost:3000/` until it responds,
and prints the PID. Calling `start` again when it's already up is a
no-op (`already running on ...`).

| command | what it does |
|---|---|
| `start` | background-launch + readiness poll, PID → `/tmp/ibh-server.pid` |
| `stop` | kills the tracked PID (or falls back to `pkill -f "node server.js"`) |
| `smoke` | curl checks: homepage, `/css/base.css`, `/js/app.js`, `/api/products`, `/ibh-manage` — asserts real `Content-Type`s |
| `screenshot <path> <out.png> [w] [h]` | headless Chrome screenshot of `http://localhost:3000<path>`, default 1440x900 |
| `admin-session` | mints a temporary session token for the first `role='admin'` account and prints `TOKEN=...` |
| `revoke-session <token>` | deletes that session row |

Verified this session, in order, from a cold stop:

```bash
.claude/skills/run-ibh-project/driver.sh start
# → up on http://localhost:3000 (pid 39949)

.claude/skills/run-ibh-project/driver.sh smoke
# -- homepage --
# HTTP:200  Content-Type:text/html; charset=utf-8
# -- css/base.css (must be text/css, not text/html) --
# HTTP:200  Content-Type:text/css; charset=UTF-8
# -- js/app.js (must be application/javascript, not text/html) --
# HTTP:200  Content-Type:application/javascript; charset=UTF-8
# -- api/products --
# HTTP:200  Content-Type:application/json; charset=utf-8
# -- admin dashboard shell (/ibh-manage) --
# HTTP:200  Content-Type:text/html; charset=UTF-8

.claude/skills/run-ibh-project/driver.sh screenshot / /tmp/home.png
# → renders the full storefront: header, hero (title/CTA/stats), footer

TOKEN=$(.claude/skills/run-ibh-project/driver.sh admin-session | grep TOKEN= | cut -d= -f2)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/users
# → real JSON array of accounts

.claude/skills/run-ibh-project/driver.sh revoke-session "$TOKEN"
# → revoked

.claude/skills/run-ibh-project/driver.sh stop
# → stopped
```

Useful pages to screenshot: `/` (home), `/shop`, `/terms`, `/ibh-manage`
(admin — client-side auth-gated, so the raw screenshot just shows the
login state, not real dashboard content, without also driving a login
flow).

## Run (human path)

```bash
npm start          # binds to :3000, blocks the foreground
# or
npm run dev         # same, but restarts on file changes (node --watch)
```

Stop with Ctrl-C, or from another shell: `pkill -f "node server.js"`.

---

## Gotchas

- **Every route search-and-replace to `/api/index` in `vercel.json` breaks
  static assets in production.** This repo's `vercel.json` originally had
  `{"source": "/(.*)", "destination": "/api/index"}`, which rewrites
  *every* request — including `/css/*.css`, `/js/*.js`, `/assets/*` — to
  the Express serverless function. Confirmed live on the deployed
  `https://ibh-nu.vercel.app`: `curl -o /dev/null -w '%{content_type}'
  .../css/base.css` returned `text/html` (the SPA fallback HTML) instead
  of CSS, so the whole site rendered unstyled. Fix: scope the rewrite so
  static prefixes bypass the function —
  `"source": "/((?!css/|js/|assets/|images/|favicon\\.ico|robots\\.txt).*)"`.
  The `smoke` command's content-type assertions on `/css/base.css` and
  `/js/app.js` exist specifically to catch this class of regression
  locally before it ships to Vercel (locally it's proxied through the
  same Express `express.static`, so it won't reproduce the Vercel-only
  routing bug — but it does catch anyone breaking the static middleware
  itself).
- **`requireAuth`-gated routes need a real session row, not a login
  flow.** There's no seeded admin password known to an agent. Rather than
  guessing credentials or calling `/api/auth/login`, `admin-session`
  inserts a row directly into the `sessions` table for an existing admin
  account (same trick used throughout manual testing this session) and
  prints the bearer token. Always pair it with `revoke-session` afterwards
  — these are real rows in the real Supabase database, not a test double.
- **Multiple `accounts` rows can look like "the admin."** A query for
  `role='admin' LIMIT 1` isn't stable if roles change between calls (seen
  mid-session: an account that was `admin` in one query came back
  `staff` moments later because of real concurrent app usage). If an
  authenticated smoke check gets `403 Insufficient permissions`, don't
  assume the token minting is broken — re-run `admin-session` to get a
  fresh lookup rather than reusing an old token tied to an account whose
  role may have changed.
- **`fs.watch` on `partials/` auto-rebuilds `index.html`.** Editing any
  `partials/*.html` file while the server is running is picked up within
  ~120ms (debounced) — no restart needed to see markup changes. Route/API
  changes under `routes/*.js` or `services/*.js` **do** need a restart
  (`driver.sh stop && driver.sh start`) since `require()` caches them at
  boot.
- **No test suite exists** (`package.json` has no `test` script). Treat
  `smoke` + a screenshot as the verification step for changes in this repo.

## Troubleshooting

- **`Error: DATABASE_URL is not set`** on start: `.env` is missing or not
  in the project root. The app has no sqlite/local-storage fallback
  anymore — it hard-throws in `database/db.js` on boot.
- **`driver.sh start` prints "server did not come up"**: check
  `/tmp/ibh-server.log` — almost always the `DATABASE_URL` error above, or
  port 3000 already bound by a non-tracked process (`ss -ltnp | grep 3000`
  to find the PID, since `driver.sh stop` only knows about PIDs it started).
- **Screenshot looks blank/unstyled locally**: rare locally (see the
  vercel.json gotcha above for why it happens in *production*); locally,
  check `/tmp/ibh-chrome.log` for a `vaInitialize failed` GPU warning —
  harmless — or confirm the server is actually serving on the port you
  screenshotted (`smoke` first).
