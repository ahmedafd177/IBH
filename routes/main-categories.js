const express = require('express');
const db      = require('../database/db');
const router  = express.Router();

/* GET /api/main-categories */
router.get('/', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM main_categories ORDER BY id ASC').all());
});

/* PUT /api/main-categories/:id — update image only (names are fixed) */
router.put('/:id', async (req, res) => {
  const { image } = req.body;
  const existing = await db.prepare('SELECT * FROM main_categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await db.prepare('UPDATE main_categories SET image = ? WHERE id = ?').run(image ?? existing.image, req.params.id);
  res.json(await db.prepare('SELECT * FROM main_categories WHERE id = ?').get(req.params.id));
});

module.exports = router;
