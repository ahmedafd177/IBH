# Deploying IBH to Vercel + Supabase

The backend now talks to a **Supabase Postgres** database instead of a local
SQLite file, and uploaded images go to **Supabase Storage** instead of local
disk — both required because Vercel's serverless functions have a read-only,
ephemeral filesystem (anything written to disk disappears between requests
and is wiped on every deploy).

---

## Step 1 — Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Once it's provisioned, go to **Project Settings → Database → Connection string**.
3. Copy the **connection pooling** string (port `6543`, "Transaction" mode —
   labeled "Connection pooling" in the dashboard). Serverless functions open a
   fresh connection per invocation, so you must use the pooled connection,
   not the direct one on port 5432.
4. Go to **Project Settings → API** and copy the **Project URL** and the
   **service_role** key (not the anon key — uploads need elevated storage
   permissions).

## Step 2 — Create the Storage bucket

1. In Supabase: **Storage → New bucket**.
2. Name it `uploads` and mark it **Public** (so product images load directly
   in the browser without a signed URL).

## Step 3 — Set local env vars and create the schema

Add to your local `.env` (never committed — already gitignored):

```
DATABASE_URL=postgres://postgres.xxxxx:YOUR_PASSWORD@aws-0-xxxx.pooler.supabase.com:6543/postgres?pgbouncer=true
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_UPLOAD_BUCKET=uploads
```

Run the app once locally (`npm start`) — `database/db.js` creates every table
automatically on boot and seeds default brands/categories/a fresh admin
account. Watch the console for `Database initialization failed` errors if
something's misconfigured.

## Step 4 — Carry over your existing data (one-time)

If you already have real products/orders/accounts in `database/ibh.sqlite`,
copy them into the new Postgres database now, before using the app for real:

```bash
npm run migrate
```

This **truncates** the just-seeded default tables in Postgres first, then
copies every row from `ibh.sqlite` over (preserving ids), so the sqlite data
becomes the single source of truth. Existing login sessions are not carried
over — users will need to sign in again. Re-run is safe (it always starts by
truncating), but don't run it a second time after you've already added new
data through the live app, since it would wipe that too.

Images already sitting in `assets/uploads/` are **not** copied to Supabase
Storage automatically — re-upload any product images you want to keep
through the admin panel after cutover.

---

## Step 5 — Push your code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
```

**Make sure `.gitignore` excludes secrets** (already set up):
```
node_modules/
.env
database/*.sqlite
assets/uploads/
```

Create a repo on github.com, then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/ibh.git
git push -u origin main
```

---

## Step 6 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New → Project** → import your `ibh` repository.
3. Vercel auto-detects `vercel.json` and `api/index.js` — no build command
   needed (this is a plain Express server wrapped as a serverless function).

### Environment variables

In Vercel: **Project → Settings → Environment Variables** → add each:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase pooled connection string (from Step 1) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
| `SUPABASE_UPLOAD_BUCKET` | `uploads` |
| `RESEND_API_KEY` | from [resend.com](https://resend.com) — powers new-order emails to admin/staff/branch managers |
| `ORDER_NOTIFICATION_FROM_EMAIL` | `onboarding@resend.dev` (until you verify your own domain in Resend) |
| `APP_URL` | `https://YOUR-APP.vercel.app` — used for the admin dashboard link inside notification emails |
| `GOOGLE_CLIENT_ID` | your Google OAuth client ID |
| `SESSION_SECRET` | a long random string |
| `MPESA_ENV` | `sandbox` (change to `production` when live) |
| `MPESA_CONSUMER_KEY` | from Daraja portal |
| `MPESA_CONSUMER_SECRET` | from Daraja portal |
| `MPESA_SHORTCODE` | your Paybill/Till number |
| `MPESA_PASSKEY` | from Daraja portal |
| `MPESA_CALLBACK_URL` | `https://YOUR-APP.vercel.app/api/mpesa/callback` |

Deploy. Every `git push` to `main` afterward triggers an automatic redeploy —
since the database lives in Supabase (not on Vercel's disk), products/orders
added through the admin panel persist across deploys.

---

## M-PESA in production

1. Go to [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
2. Create an app → get your **Consumer Key** and **Consumer Secret**
3. Apply for **Go-Live** to get production credentials
4. Update Vercel env vars with production credentials and set `MPESA_ENV=production`
5. Your callback URL (`/api/mpesa/callback`) must be HTTPS — Vercel provides this automatically

**Test in sandbox first:**
- Use sandbox shortcode `174379` and test phone `254708374149`
- STK push will simulate on the test number

---

## Custom domain (optional)

In Vercel: **Settings → Domains** → add `shop.ibh.co.ke`, then follow the DNS
records Vercel shows you (usually a `CNAME` to `cname.vercel-dns.com`).
