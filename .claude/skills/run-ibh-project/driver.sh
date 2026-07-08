#!/usr/bin/env bash
# Driver for running/driving the IBH Express app from a clean shell.
# Run all commands from the project root (the directory containing package.json).
set -euo pipefail

PORT="${PORT:-3000}"
BASE="http://localhost:${PORT}"
LOG="/tmp/ibh-server.log"
PIDFILE="/tmp/ibh-server.pid"

cmd="${1:-help}"
shift || true

case "$cmd" in

  start)
    if curl -sf "$BASE" >/dev/null 2>&1; then
      echo "already running on $BASE"
      exit 0
    fi
    node server.js > "$LOG" 2>&1 &
    echo $! > "$PIDFILE"
    for i in $(seq 1 30); do
      curl -sf "$BASE" >/dev/null 2>&1 && { echo "up on $BASE (pid $(cat "$PIDFILE"))"; exit 0; }
      sleep 1
    done
    echo "server did not come up — see $LOG"; cat "$LOG"; exit 1
    ;;

  stop)
    if [ -f "$PIDFILE" ]; then
      kill "$(cat "$PIDFILE")" 2>/dev/null || true
      rm -f "$PIDFILE"
    else
      pkill -f "node server.js" 2>/dev/null || true
    fi
    echo "stopped"
    ;;

  smoke)
    # Basic liveness + the static-asset regression this skill was built to catch
    # (a vercel.json rewrite that swallows /css, /js, /assets into the SPA
    # fallback — see Gotchas in SKILL.md).
    echo "-- homepage --"
    curl -s -o /dev/null -w "HTTP:%{http_code}  Content-Type:%{content_type}\n" "$BASE/"
    echo "-- css/base.css (must be text/css, not text/html) --"
    curl -s -o /dev/null -w "HTTP:%{http_code}  Content-Type:%{content_type}\n" "$BASE/css/base.css"
    echo "-- js/app.js (must be application/javascript, not text/html) --"
    curl -s -o /dev/null -w "HTTP:%{http_code}  Content-Type:%{content_type}\n" "$BASE/js/app.js"
    echo "-- api/products --"
    curl -s -o /dev/null -w "HTTP:%{http_code}  Content-Type:%{content_type}\n" "$BASE/api/products"
    echo "-- admin dashboard shell (/ibh-manage) --"
    curl -s -o /dev/null -w "HTTP:%{http_code}  Content-Type:%{content_type}\n" "$BASE/ibh-manage"
    ;;

  screenshot)
    # Usage: driver.sh screenshot <path e.g. / or /terms> <outfile.png> [width] [height]
    path="${1:?path required, e.g. /}"
    out="${2:?output png path required}"
    width="${3:-1440}"
    height="${4:-900}"
    google-chrome --headless --disable-gpu --no-sandbox --hide-scrollbars \
      --window-size="${width},${height}" --virtual-time-budget=4000 \
      --screenshot="$out" "$BASE$path" 2>/tmp/ibh-chrome.log
    echo "wrote $out"
    ;;

  admin-session)
    # Mints a temporary session token for the first admin account found, so
    # you can hit requireAuth(['admin']) routes with curl. Requires .env
    # (DATABASE_URL) to be present — same DB the running server uses.
    node -e "
      require('dotenv').config();
      const db = require('./database/db');
      const crypto = require('crypto');
      (async () => {
        const acc = await db.prepare(\"SELECT id, name, email FROM accounts WHERE role='admin' LIMIT 1\").get();
        if (!acc) { console.error('no admin account found'); process.exit(1); }
        const token = crypto.randomBytes(24).toString('hex');
        await db.prepare(\"INSERT INTO sessions (id, account_id, expires_at) VALUES (?, ?, NOW() + interval '1 hour')\").run(token, acc.id);
        console.log('TOKEN=' + token);
        console.log('ACCOUNT=' + acc.name + ' <' + acc.email + '>');
        process.exit(0);
      })().catch(e => { console.error(e); process.exit(1); });
    "
    ;;

  revoke-session)
    token="${1:?token required}"
    node -e "
      require('dotenv').config();
      const db = require('./database/db');
      db.prepare('DELETE FROM sessions WHERE id = ?').run('$token').then(() => { console.log('revoked'); process.exit(0); });
    "
    ;;

  *)
    echo "usage: driver.sh {start|stop|smoke|screenshot <path> <out.png>|admin-session|revoke-session <token>}"
    exit 1
    ;;
esac
