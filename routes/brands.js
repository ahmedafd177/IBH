const express = require('express');
const db      = require('../database/db');
const router  = express.Router();

/* GET /api/brands */
router.get('/', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM brands ORDER BY name ASC').all());
});

/* POST /api/brands */
router.post('/', async (req, res) => {
  const { name, image = null } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const info = await db.prepare('INSERT INTO brands (name, image) VALUES (?, ?) RETURNING id').run(name, image);
    res.status(201).json({ id: info.rows[0].id, name, image });
  } catch {
    res.status(409).json({ error: 'Brand already exists' });
  }
});

/* PUT /api/brands/:id */
router.put('/:id', async (req, res) => {
  const { oldName, name, image } = req.body;
  const existing = await db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  await db.prepare('UPDATE brands SET name = ?, image = ? WHERE id = ?').run(name, image ?? existing.image, req.params.id);

  /* Rename brand on all products */
  if (oldName && oldName !== name) {
    await db.prepare('UPDATE products SET brand = ? WHERE brand = ?').run(name, oldName);
  }

  res.json(await db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.id));
});

/* DELETE /api/brands/:id */
router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM brands WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
