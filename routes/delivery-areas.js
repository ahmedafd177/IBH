const express = require('express');
const db      = require('../database/db');
const router  = express.Router();

/* GET /api/delivery-areas */
router.get('/', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM delivery_areas ORDER BY name ASC').all());
});

/* POST /api/delivery-areas */
router.post('/', async (req, res) => {
  const { name, price } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'name and price required' });
  try {
    const info = await db.prepare('INSERT INTO delivery_areas (name, price) VALUES (?, ?) RETURNING id').run(name, Number(price));
    res.status(201).json({ id: info.rows[0].id, name, price: Number(price) });
  } catch {
    res.status(409).json({ error: 'Area already exists' });
  }
});

/* PUT /api/delivery-areas/:id */
router.put('/:id', async (req, res) => {
  const { name, price } = req.body;
  const existing = await db.prepare('SELECT * FROM delivery_areas WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await db.prepare('UPDATE delivery_areas SET name = ?, price = ? WHERE id = ?')
    .run(name ?? existing.name, price != null ? Number(price) : existing.price, req.params.id);
  res.json(await db.prepare('SELECT * FROM delivery_areas WHERE id = ?').get(req.params.id));
});

/* DELETE /api/delivery-areas/:id */
router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM delivery_areas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
