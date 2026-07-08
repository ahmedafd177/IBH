const express            = require('express');
const db                 = require('../database/db');
const { softAuth, requireAuth } = require('../middleware/auth');
const { notifyNewOrder } = require('../services/email');
const router             = express.Router();

function row2js(o) {
  if (!o) return null;
  return {
    ...o,
    items:    JSON.parse(o.items    || '[]'),
    customer: JSON.parse(o.customer || '{}'),
  };
}

function autoPaymentStatus(payment) {
  return payment === 'cod' ? 'pending' : 'paid';
}

/* GET /api/orders — all orders (public for customer order lookup) */
router.get('/', softAuth, async (req, res) => {
  const { search, status, date } = req.query;
  let sql    = 'SELECT * FROM orders WHERE 1=1';
  const args = [];

  if (status) { sql += ' AND status = ?'; args.push(status); }
  if (date)   { sql += ' AND date = ?';   args.push(date); }
  if (search) {
    const q = `%${search}%`;
    sql += ' AND (id ILIKE ? OR customer ILIKE ?)';
    args.push(q, q);
  }

  sql += ' ORDER BY created_at DESC';
  res.json((await db.prepare(sql).all(...args)).map(row2js));
});

/* POST /api/orders */
router.post('/', async (req, res) => {
  const o              = req.body;
  const now            = new Date();
  const id             = 'IBH-' + Date.now();
  const payment        = o.payment || 'mpesa';
  const payment_status = autoPaymentStatus(payment);
  await db.prepare(`
    INSERT INTO orders (id, status, date, time, total, items, customer, payment, payment_status, mpesa_ref, coupon_code, coupon_discount)
    VALUES (?, 'confirmed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    now.toLocaleDateString('en-KE'),
    now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
    o.total || 0,
    JSON.stringify(o.items    || []),
    JSON.stringify(o.customer || {}),
    payment,
    payment_status,
    o.mpesaRef        || null,
    o.coupon_code     || null,
    o.coupon_discount || 0,
  );
  const created = row2js(await db.prepare('SELECT * FROM orders WHERE id = ?').get(id));

  /* Notify order recipients — configurable in Settings; falls back to
     every admin/staff/branch manager account when nothing is configured. */
  const notifSetting = await db.prepare("SELECT value FROM settings WHERE key = 'order_notification_emails'").get();
  let recipientEmails = (notifSetting?.value || '').split(',').map(e => e.trim()).filter(Boolean);
  if (!recipientEmails.length) {
    const recipients = await db.prepare(
      "SELECT email FROM accounts WHERE role IN ('admin','staff','branch_manager') AND email != ''"
    ).all();
    recipientEmails = recipients.map(r => r.email);
  }
  await notifyNewOrder(created, recipientEmails);

  res.status(201).json(created);
});

/* PATCH /api/orders/:id — update status, payment_status, branch, assignment */
router.patch('/:id', softAuth, async (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const o  = await db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!o) return res.status(404).json({ error: 'Not found' });

  const status         = req.body.status         ?? o.status;
  const payment_status = req.body.payment_status ?? o.payment_status ?? 'pending';
  const branch         = req.body.branch         !== undefined ? (req.body.branch || null) : o.branch;
  const assigned_to    = req.body.assigned_to    !== undefined ? (req.body.assigned_to || null) : o.assigned_to;
  const assigned_name  = req.body.assigned_name  !== undefined ? (req.body.assigned_name || null) : o.assigned_name;

  await db.prepare('UPDATE orders SET status = ?, payment_status = ?, branch = ?, assigned_to = ?, assigned_name = ? WHERE id = ?')
    .run(status, payment_status, branch, assigned_to, assigned_name, id);

  /* auto-add a note when status changes */
  if (req.body.status && req.body.status !== o.status) {
    const author = req.account ? req.account.name : 'System';
    const aid    = req.account?.id || null;
    await db.prepare('INSERT INTO order_notes (order_id, author_id, author_name, note, is_internal) VALUES (?, ?, ?, ?, 1)')
      .run(id, aid, author, `Status changed to "${req.body.status}"`);
  }

  res.json({ ok: true });
});

/* GET /api/orders/:id/notes */
router.get('/:id/notes', softAuth, async (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const notes = await db.prepare('SELECT * FROM order_notes WHERE order_id = ? ORDER BY created_at ASC').all(id);
  res.json(notes);
});

/* POST /api/orders/:id/notes */
router.post('/:id/notes', softAuth, async (req, res) => {
  const id   = decodeURIComponent(req.params.id);
  const note = (req.body.note || '').trim();
  if (!note) return res.status(400).json({ error: 'note required' });
  const author      = req.account ? req.account.name : (req.body.author_name || 'Staff');
  const aid         = req.account?.id || null;
  const is_internal = req.body.is_internal ? 1 : 0;
  const info = await db.prepare('INSERT INTO order_notes (order_id, author_id, author_name, note, is_internal) VALUES (?, ?, ?, ?, ?) RETURNING id')
    .run(id, aid, author, note, is_internal);
  res.status(201).json({ id: info.rows[0].id, order_id: id, author_name: author, note, is_internal, created_at: new Date().toISOString() });
});

/* DELETE /api/orders/:id — admin only */
router.delete('/:id', requireAuth(['admin']), async (req, res) => {
  const id = decodeURIComponent(req.params.id);
  await db.prepare('DELETE FROM order_notes WHERE order_id = ?').run(id);
  await db.prepare('DELETE FROM orders WHERE id = ?').run(id);
  res.json({ ok: true });
});

module.exports = router;
