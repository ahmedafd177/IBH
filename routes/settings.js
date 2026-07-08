const express = require('express');
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router  = express.Router();

/* GET /api/settings — return all settings as { key: value } map */
router.get('/', async (req, res) => {
  const rows = await db.prepare('SELECT key, value FROM settings').all();
  const map  = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json(map);
});

/* PUT /api/settings — upsert any number of keys — admin only */
router.put('/', requireAuth(['admin']), async (req, res) => {
  await db.transaction(async (prepare) => {
    const upsert = prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const [k, v] of Object.entries(req.body)) {
      await upsert.run(k, String(v ?? ''));
    }
  });
  res.json({ ok: true });
});

module.exports = router;
