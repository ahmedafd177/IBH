const express = require('express');
const crypto  = require('crypto');
const db      = require('../database/db');
const router  = express.Router();

/* Same salt as routes/auth.js */
const hash = pw => crypto.createHash('sha256').update(pw + 'ibh-2025').digest('hex');

/* GET /api/users — accounts merged with order stats */
router.get('/', (req, res) => {
  const accounts = db.prepare(
    'SELECT id, name, phone, email, role, branch, created_at FROM accounts ORDER BY id ASC'
  ).all();

  const orders = db.prepare('SELECT total, date, customer FROM orders').all().map(o => ({
    ...o, customer: JSON.parse(o.customer || '{}'),
  }));

  const stats = {};
  orders.forEach(o => {
    const phone = o.customer?.phone || '';
    if (!phone) return;
    if (!stats[phone]) stats[phone] = { orderCount: 0, totalSpent: 0, lastOrder: '' };
    stats[phone].orderCount++;
    stats[phone].totalSpent += o.total || 0;
    if (!stats[phone].lastOrder || o.date > stats[phone].lastOrder)
      stats[phone].lastOrder = o.date;
  });

  res.json(accounts.map(a => ({
    id:         a.id,
    name:       a.name,
    phone:      a.phone,
    email:      a.email,
    role:       a.role,
    branch:     a.branch || '',
    createdAt:  a.created_at,
    orderCount: stats[a.phone]?.orderCount || 0,
    totalSpent: stats[a.phone]?.totalSpent || 0,
    lastOrder:  stats[a.phone]?.lastOrder  || '',
  })));
});

/* POST /api/users */
router.post('/', (req, res) => {
  const { name, phone, email = '', role = 'customer', branch = '', password = 'ibh2025' } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });
  try {
    const info = db.prepare(
      'INSERT INTO accounts (name, phone, email, role, branch, password_hash) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, phone.trim(), email, role, branch, hash(password));
    res.status(201).json({ id: info.lastInsertRowid, name, phone, email, role, branch });
  } catch {
    res.status(409).json({ error: 'Phone number already registered' });
  }
});

/* PUT /api/users/:id */
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const name   = req.body.name   ?? existing.name;
  const email  = req.body.email  ?? existing.email;
  const role   = req.body.role   ?? existing.role;
  const branch = req.body.branch ?? existing.branch ?? '';
  db.prepare('UPDATE accounts SET name = ?, email = ?, role = ?, branch = ? WHERE id = ?')
    .run(name, email, role, branch, req.params.id);
  res.json(db.prepare('SELECT id, name, phone, email, role, branch FROM accounts WHERE id = ?')
    .get(req.params.id));
});

/* DELETE /api/users/:id */
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
