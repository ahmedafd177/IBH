const express = require('express');
const db      = require('../database/db');
const router  = express.Router();

router.get('/', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM branches ORDER BY id ASC').all());
});

router.post('/', async (req, res) => {
  const { name, location = '', phone = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const info = await db.prepare('INSERT INTO branches (name, location, phone) VALUES (?, ?, ?) RETURNING id')
      .run(name.trim(), location.trim(), phone.trim());
    res.status(201).json({ id: info.rows[0].id, name, location, phone });
  } catch { res.status(409).json({ error: 'Branch name already exists' }); }
});

router.put('/:id', async (req, res) => {
  const b = await db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  const name     = (req.body.name     ?? b.name).trim();
  const location = (req.body.location ?? b.location).trim();
  const phone    = (req.body.phone    ?? b.phone).trim();
  await db.prepare('UPDATE branches SET name = ?, location = ?, phone = ? WHERE id = ?')
    .run(name, location, phone, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM branches WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
