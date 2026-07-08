const express   = require('express');
const bcryptjs  = require('bcryptjs');
const db        = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router    = express.Router();

const hash = pw => bcryptjs.hashSync(pw, 10);

const PRIVILEGED_ROLES = ['staff', 'branch_manager', 'admin'];

/* GET /api/users — accounts merged with order stats */
router.get('/', requireAuth(['admin', 'staff', 'branch_manager']), async (req, res) => {
  const accounts = await db.prepare(
    'SELECT id, name, phone, email, role, branch, created_at FROM accounts ORDER BY id ASC'
  ).all();

  const orders = (await db.prepare('SELECT total, date, customer FROM orders').all()).map(o => ({
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

/* POST /api/users — only admin can create privileged roles */
router.post('/', requireAuth(['admin']), async (req, res) => {
  const { name, phone, email = '', role = 'customer', branch = '', password = 'ibh2025' } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });
  const safeRole = PRIVILEGED_ROLES.includes(role) ? role : 'customer';
  try {
    const info = await db.prepare(
      'INSERT INTO accounts (name, phone, email, role, branch, password_hash) VALUES (?, ?, ?, ?, ?, ?) RETURNING id'
    ).run(name, phone.trim(), email, safeRole, branch, hash(password));
    res.status(201).json({ id: info.rows[0].id, name, phone, email, role: safeRole, branch });
  } catch {
    res.status(409).json({ error: 'Phone number already registered' });
  }
});

/* PUT /api/users/:id — only admin can change roles */
router.put('/:id', requireAuth(['admin']), async (req, res) => {
  const existing = await db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const name   = req.body.name   ?? existing.name;
  const email  = req.body.email  ?? existing.email;
  const role   = req.body.role   ?? existing.role;
  const branch = req.body.branch ?? existing.branch ?? '';
  await db.prepare('UPDATE accounts SET name = ?, email = ?, role = ?, branch = ? WHERE id = ?')
    .run(name, email, role, branch, req.params.id);
  res.json(await db.prepare('SELECT id, name, phone, email, role, branch FROM accounts WHERE id = ?')
    .get(req.params.id));
});

/* PUT /api/users/:id/password — admin resets any user's password */
router.put('/:id/password', requireAuth(['admin']), async (req, res) => {
  const password = (req.body.password || '').trim();
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const existing = await db.prepare('SELECT id FROM accounts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(hash(password), req.params.id);
  res.json({ ok: true });
});

/* DELETE /api/users/:id — only admin can delete accounts */
router.delete('/:id', requireAuth(['admin']), async (req, res) => {
  await db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
