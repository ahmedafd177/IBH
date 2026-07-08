const express = require('express');
const db      = require('../database/db');
const router  = express.Router();

/* GET /api/categories */
router.get('/', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM categories ORDER BY name ASC').all());
});

/* POST /api/categories */
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const info = await db.prepare('INSERT INTO categories (name) VALUES (?) RETURNING id').run(name);
    res.status(201).json({ id: info.rows[0].id, name });
  } catch {
    res.status(409).json({ error: 'Category already exists' });
  }
});

/* POST /api/categories/rename */
router.post('/rename', async (req, res) => {
  const { oldName, newName } = req.body;
  if (!oldName || !newName) return res.status(400).json({ error: 'oldName and newName required' });

  await db.prepare('UPDATE categories SET name = ? WHERE name = ?').run(newName, oldName);
  /* Update products that used this category */
  await db.prepare('UPDATE products SET subcat = ? WHERE subcat = ?').run(newName, oldName);
  res.json({ ok: true });
});

/* DELETE /api/categories/:id */
router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
