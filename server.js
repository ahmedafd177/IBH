/* ═══════════════════════════════════════
   IBH — Express server
   Run: node server.js   (or: npm start)
   PORT defaults to 3000
   ═══════════════════════════════════════ */
require('dotenv').config();

/* A single serverless instance can be mid-flight on several unrelated
   concurrent requests. Node's default behavior for an unhandled promise
   rejection (e.g. a transient DB error in a route with no try/catch) is
   to crash the whole process — killing every other in-flight request on
   this instance, not just the one that failed. Log instead so one bad
   request can't take the rest down with it. */
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const cors    = require('cors');

/* ── Assemble index.html from partials ── */
const { buildIndex } = require('./build');

/* ── Keep index.html in sync with partials ── */
function syncIndex() {
  try {
    fs.writeFileSync(path.join(__dirname, 'index.html'), buildIndex());
  } catch (e) {
    console.error('Failed to sync index.html:', e.message);
  }
}

/* Vercel's filesystem is read-only outside /tmp and each invocation is
   short-lived, so writing/watching index.html on disk is pointless there
   (the `/` and `/index.html` routes below already serve buildIndex() from
   memory on every request — this disk copy is only a convenience for local
   static-file inspection). */
if (!process.env.VERCEL) {
  syncIndex(); // write on startup

  let _rebuildTimer;
  fs.watch(path.join(__dirname, 'partials'), () => {
    clearTimeout(_rebuildTimer);
    _rebuildTimer = setTimeout(() => {
      syncIndex();
      console.log('↺  index.html rebuilt from partials');
    }, 120);
  });
}

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Middleware ── */
app.use(cors());
app.use(express.json());

/* ── Intercept /js/config.js — patch backend flags and inject env vars ── */
app.get('/js/config.js', (req, res) => {
  const googleId = process.env.GOOGLE_CLIENT_ID || '';
  const config = fs.readFileSync(path.join(__dirname, 'js', 'config.js'), 'utf8')
    .replace('USE_LOCAL_STORAGE: true', 'USE_LOCAL_STORAGE: false')
    .replace('BASE_URL:          null', "BASE_URL:          '/api'")
    .replace("GOOGLE_CLIENT_ID: ''", `GOOGLE_CLIENT_ID: '${googleId}'`);
  res.type('application/javascript').send(config);
});

/* ── API routes ── */
app.use('/api/products',   require('./routes/products'));
app.use('/api/brands',     require('./routes/brands'));
app.use('/api/categories',      require('./routes/categories'));
app.use('/api/main-categories', require('./routes/main-categories'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/upload',     require('./routes/upload'));
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/delivery-areas', require('./routes/delivery-areas'));
app.use('/api/reviews',        require('./routes/reviews'));
app.use('/api/coupons',        require('./routes/coupons'));
app.use('/api/branches',       require('./routes/branches'));
app.use('/api/settings',       require('./routes/settings'));
app.use('/api/mpesa',          require('./routes/mpesa'));

/* ── Serve assembled index.html ── */
app.get('/', (req, res) => res.type('html').send(buildIndex()));
app.get('/index.html', (req, res) => res.type('html').send(buildIndex()));

/* ── Admin panel — served only at /ibh-manage (not via static) ── */
app.get('/ibh-manage', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});
/* Block direct guessing of admin.html */
app.get('/admin.html', (req, res) => res.redirect('/'));

/* ── Static files (CSS, JS, assets — but NOT admin.html direct) ── */
app.use(express.static(path.join(__dirname), {
  index: false,
}));

/* ── SPA fallback ── */
app.get('*', (req, res) => res.type('html').send(buildIndex()));

/* Only bind a port when run directly (`node server.js` / `npm start`).
   On Vercel, api/index.js requires this file just to get `app` and lets
   the platform's own request dispatcher invoke it — listen() would be
   both unnecessary and unsupported there. */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`IBH server running → http://localhost:${PORT}`);
  });
}

module.exports = app;
