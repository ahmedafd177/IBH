/* ═══════════════════════════════════════
   IBH — Express server
   Run: node server.js   (or: npm start)
   PORT defaults to 3000
   ═══════════════════════════════════════ */
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

syncIndex(); // write on startup

let _rebuildTimer;
fs.watch(path.join(__dirname, 'partials'), () => {
  clearTimeout(_rebuildTimer);
  _rebuildTimer = setTimeout(() => {
    syncIndex();
    console.log('↺  index.html rebuilt from partials');
  }, 120);
});

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Middleware ── */
app.use(cors());
app.use(express.json());

/* ── Intercept /js/config.js — patch only the two backend flags ── */
app.get('/js/config.js', (req, res) => {
  const config = fs.readFileSync(path.join(__dirname, 'js', 'config.js'), 'utf8')
    .replace('USE_LOCAL_STORAGE: true', 'USE_LOCAL_STORAGE: false')
    .replace('BASE_URL:          null', "BASE_URL:          '/api'");
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

/* ── Serve assembled index.html ── */
app.get('/', (req, res) => res.type('html').send(buildIndex()));
app.get('/index.html', (req, res) => res.type('html').send(buildIndex()));

/* ── Static files (CSS, JS, assets, admin.html, etc.) ── */
app.use(express.static(path.join(__dirname)));

/* ── SPA fallback ── */
app.get('*', (req, res) => res.type('html').send(buildIndex()));

app.listen(PORT, () => {
  console.log(`IBH server running → http://localhost:${PORT}`);
});
