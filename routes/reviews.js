const express = require('express');
const db      = require('../database/db');
const router  = express.Router();

/* GET /api/reviews/:productId */
router.get('/:productId', (req, res) => {
  const reviews = db.prepare(
    'SELECT * FROM reviews WHERE product_id = ? ORDER BY id DESC'
  ).all(req.params.productId);
  const avg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null;
  res.json({ reviews, avg, count: reviews.length });
});

/* POST /api/reviews */
router.post('/', (req, res) => {
  const { product_id, name, rating, comment } = req.body;
  if (!product_id || !name || !rating)
    return res.status(400).json({ error: 'product_id, name, and rating are required' });
  if (rating < 1 || rating > 5)
    return res.status(400).json({ error: 'rating must be 1–5' });
  const info = db.prepare(
    'INSERT INTO reviews (product_id, name, rating, comment) VALUES (?, ?, ?, ?)'
  ).run(product_id, name.trim(), Number(rating), (comment || '').trim());
  res.status(201).json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(info.lastInsertRowid));
});

module.exports = router;
