/* ═══════════════════════════════════════
   IBH — Express server
   Run: node server.js   (or: npm start)
   PORT defaults to 3000
   ═══════════════════════════════════════ */
const express = require('express');
const path    = require('path');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Middleware ── */
app.use(cors());
app.use(express.json());

/* ── Intercept /js/config.js — switch frontend to backend mode ── */
app.get('/js/config.js', (req, res) => {
  res.type('application/javascript').send(`
const Config = {
  USE_LOCAL_STORAGE: false,
  BASE_URL: '/api',
  LS_KEYS: {
    PRODUCTS:   'ibh_products',
    BRANDS:     'ibh_brands',
    CATEGORIES: 'ibh_categories',
    CART:       'ibh_cart',
    WISHLIST:   'ibh_wishlist',
    ORDERS:     'ibh_orders',
  },
};
`);
});

/* ── API routes ── */
app.use('/api/products',   require('./routes/products'));
app.use('/api/brands',     require('./routes/brands'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/upload',     require('./routes/upload'));
app.use('/api/auth',       require('./routes/auth'));

/* ── Static files (CSS, JS, assets, HTML) ── */
app.use(express.static(path.join(__dirname)));

/* ── SPA fallback ── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`IBH server running → http://localhost:${PORT}`);
});
