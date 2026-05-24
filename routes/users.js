const express = require('express');
const db      = require('../database/db');
const router  = express.Router();

/* GET /api/users — aggregated from orders */
router.get('/', (req, res) => {
  const orders = db.prepare('SELECT id, total, date, customer FROM orders').all().map(o => ({
    ...o,
    customer: JSON.parse(o.customer || '{}'),
  }));

  const map = {};
  orders.forEach(o => {
    const phone = o.customer?.phone || '';
    if (!phone) return;
    if (!map[phone]) {
      map[phone] = {
        name:       o.customer?.name  || 'Unknown',
        phone,
        email:      o.customer?.email || '',
        orderCount: 0,
        totalSpent: 0,
        lastOrder:  '',
      };
    }
    map[phone].orderCount++;
    map[phone].totalSpent += o.total || 0;
    if (!map[phone].lastOrder || o.date > map[phone].lastOrder) {
      map[phone].lastOrder = o.date;
    }
  });

  const users = Object.values(map).sort((a, b) => b.orderCount - a.orderCount);
  res.json(users);
});

module.exports = router;
