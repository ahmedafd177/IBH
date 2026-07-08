const express = require('express');
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router  = express.Router();

const today = () => new Date().toISOString().slice(0, 10);

/* GET /api/coupons?admin=1  — all (admin) or active public list */
router.get('/', async (req, res) => {
  if (req.query.admin === '1') {
    return res.json(await db.prepare('SELECT * FROM coupons ORDER BY id DESC').all());
  }
  const coupons = await db.prepare(`
    SELECT code, type, value, min_order, expires_at
    FROM coupons
    WHERE is_active = 1
      AND (max_uses = 0 OR uses < max_uses)
      AND (expires_at IS NULL OR expires_at >= ?)
    ORDER BY id DESC
  `).all(today());
  res.json(coupons);
});

/* POST /api/coupons/validate — checkout coupon check */
router.post('/validate', async (req, res) => {
  const { code, subtotal = 0 } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });

  const coupon = await db.prepare(`
    SELECT * FROM coupons
    WHERE UPPER(code) = UPPER(?)
      AND is_active = 1
      AND (max_uses = 0 OR uses < max_uses)
      AND (expires_at IS NULL OR expires_at >= ?)
  `).get(code.trim(), today());

  if (!coupon) return res.status(404).json({ error: 'Invalid or expired coupon code' });

  if (Number(subtotal) < coupon.min_order) {
    return res.status(400).json({
      error: `Minimum order for this code is KES ${coupon.min_order.toLocaleString()}`,
    });
  }

  const discount = coupon.type === 'percent'
    ? Math.round(Number(subtotal) * coupon.value / 100)
    : Math.min(coupon.value, Number(subtotal));

  res.json({ id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value, discount });
});

/* POST /api/coupons — admin only */
router.post('/', requireAuth(['admin']), async (req, res) => {
  const { code, type = 'percent', value, min_order = 0, max_uses = 0, expires_at = null, is_active = 1 } = req.body;
  if (!code || value === undefined || value === '') return res.status(400).json({ error: 'code and value required' });
  try {
    const info = await db.prepare(
      'INSERT INTO coupons (code, type, value, min_order, max_uses, expires_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id'
    ).run(code.trim().toUpperCase(), type, Number(value), Number(min_order), Number(max_uses), expires_at || null, is_active ? 1 : 0);
    res.status(201).json({ id: info.rows[0].id });
  } catch {
    res.status(409).json({ error: 'Coupon code already exists' });
  }
});

/* PUT /api/coupons/:id — admin only */
router.put('/:id', requireAuth(['admin']), async (req, res) => {
  const existing = await db.prepare('SELECT * FROM coupons WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { code, type, value, min_order, max_uses, expires_at, is_active } = req.body;
  await db.prepare(`UPDATE coupons SET
    code = ?, type = ?, value = ?, min_order = ?, max_uses = ?, expires_at = ?, is_active = ?
    WHERE id = ?`
  ).run(
    (code ?? existing.code).toUpperCase(),
    type       ?? existing.type,
    Number(value       ?? existing.value),
    Number(min_order   ?? existing.min_order),
    Number(max_uses    ?? existing.max_uses),
    expires_at !== undefined ? (expires_at || null) : existing.expires_at,
    is_active  !== undefined ? (is_active ? 1 : 0) : existing.is_active,
    req.params.id
  );
  res.json({ ok: true });
});

/* DELETE /api/coupons/:id — admin only */
router.delete('/:id', requireAuth(['admin']), async (req, res) => {
  await db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
