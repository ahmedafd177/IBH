const express            = require('express');
const db                 = require('../database/db');
const { softAuth }       = require('../middleware/auth');
const router             = express.Router();

function row2js(o) {
  if (!o) return null;
  return {
    ...o,
    items:    JSON.parse(o.items    || '[]'),
    customer: JSON.parse(o.customer || '{}'),
  };
}

/* GET /api/orders
   - Admin / staff → all orders
   - Branch manager → only orders where branch = their branch
   - No token       → all orders (public, e.g. customer order lookup)
*/
router.get('/', softAuth, (req, res) => {
  const { search, status, date } = req.query;
  let sql    = 'SELECT * FROM orders WHERE 1=1';
  const args = [];

  /* Branch manager sees only their branch */
  if (req.account?.role === 'branch_manager' && req.account.branch) {
    sql += ' AND branch = ?';
    args.push(req.account.branch);
  }

  if (status) { sql += ' AND status = ?'; args.push(status); }
  if (date)   { sql += ' AND date = ?';   args.push(date); }
  if (search) {
    const q = `%${search}%`;
    sql += ' AND (id LIKE ? OR customer LIKE ?)';
    args.push(q, q);
  }

  sql += ' ORDER BY rowid DESC';
  res.json(db.prepare(sql).all(...args).map(row2js));
});

/* POST /api/orders */
router.post('/', (req, res) => {
  const o   = req.body;
  const now = new Date();
  const id  = 'IBH-' + Date.now();
  db.prepare(`
    INSERT INTO orders (id, status, date, time, total, items, customer)
    VALUES (?, 'confirmed', ?, ?, ?, ?, ?)
  `).run(
    id,
    now.toLocaleDateString('en-KE'),
    now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
    o.total || 0,
    JSON.stringify(o.items    || []),
    JSON.stringify(o.customer || {}),
  );
  res.status(201).json(row2js(db.prepare('SELECT * FROM orders WHERE id = ?').get(id)));
});

/* PATCH /api/orders/:id — update status and/or branch */
router.patch('/:id', softAuth, (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const o  = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!o) return res.status(404).json({ error: 'Not found' });

  /* Branch manager can only update their own branch's orders */
  if (req.account?.role === 'branch_manager' && o.branch !== req.account.branch)
    return res.status(403).json({ error: 'Not your branch' });

  const status = req.body.status ?? o.status;
  const branch = req.body.branch !== undefined ? req.body.branch : o.branch;

  db.prepare('UPDATE orders SET status = ?, branch = ? WHERE id = ?').run(status, branch, id);
  res.json({ ok: true });
});

module.exports = router;
