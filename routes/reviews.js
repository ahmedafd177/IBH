const express = require('express');
const db      = require('../database/db');
const router  = express.Router();

async function refreshProductRating(productId) {
  const rows = await db.prepare('SELECT rating FROM reviews WHERE product_id = ?').all(productId);
  if (!rows.length) return;
  const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
  await db.prepare('UPDATE products SET rating = ?, review_count = ? WHERE id = ?')
    .run(Math.round(avg * 10) / 10, rows.length, productId);
}

/* GET /api/reviews/:productId */
router.get('/:productId', async (req, res) => {
  const reviews = await db.prepare(
    'SELECT * FROM reviews WHERE product_id = ? ORDER BY id DESC'
  ).all(req.params.productId);
  const avg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null;
  res.json({ reviews, avg: avg ? Math.round(avg * 10) / 10 : null, count: reviews.length });
});

/* POST /api/reviews */
router.post('/', async (req, res) => {
  const { product_id, name, rating, comment } = req.body;
  if (!product_id || !name || !rating)
    return res.status(400).json({ error: 'product_id, name, and rating are required' });
  if (rating < 1 || rating > 5)
    return res.status(400).json({ error: 'rating must be 1–5' });
  const info = await db.prepare(
    'INSERT INTO reviews (product_id, name, rating, comment) VALUES (?, ?, ?, ?) RETURNING id'
  ).run(product_id, name.trim(), Number(rating), (comment || '').trim());

  await refreshProductRating(product_id);

  res.status(201).json(await db.prepare('SELECT * FROM reviews WHERE id = ?').get(info.rows[0].id));
});

module.exports = router;
