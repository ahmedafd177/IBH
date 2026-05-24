const express = require('express');
const db      = require('../database/db');
const router  = express.Router();

/* GET /api/categories */
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name ASC').all());
});

/* POST /api/categories */
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const info = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
    res.status(201).json({ id: info.lastInsertRowid, name });
  } catch {
    res.status(409).json({ error: 'Category already exists' });
  }
});

/* POST /api/categories/rename */
router.post('/rename', (req, res) => {
  const { oldName, newName } = req.body;
  if (!oldName || !newName) return res.status(400).json({ error: 'oldName and newName required' });

  db.prepare('UPDATE categories SET name = ? WHERE name = ?').run(newName, oldName);
  /* Update products that used this category */
  db.prepare('UPDATE products SET subcat = ? WHERE subcat = ?').run(newName, oldName);
  res.json({ ok: true });
});

/* DELETE /api/categories/:id */
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
