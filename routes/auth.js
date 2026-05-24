const express = require('express');
const crypto  = require('crypto');
const db      = require('../database/db');
const router  = express.Router();

const hash = pass => crypto.createHash('sha256').update(pass + 'ibh-2025').digest('hex');

/* POST /api/auth/register */
router.post('/register', (req, res) => {
  const { name, phone, email, password } = req.body;
  if (!name || !phone || !email || !password)
    return res.status(400).json({ error: 'All fields are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM accounts WHERE phone = ?').get(phone);
  if (existing)
    return res.status(409).json({ error: 'Account already exists — please Sign In' });

  const info = db.prepare(
    'INSERT INTO accounts (name, phone, email, password_hash) VALUES (?, ?, ?, ?)'
  ).run(name, phone.trim(), email.trim(), hash(password));

  res.status(201).json({ id: info.lastInsertRowid, name, phone, email });
});

/* POST /api/auth/login */
router.post('/login', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password)
    return res.status(400).json({ error: 'Phone and password required' });

  const acc = db.prepare('SELECT * FROM accounts WHERE phone = ?').get(phone.trim());
  if (!acc || acc.password_hash !== hash(password))
    return res.status(401).json({ error: 'Incorrect phone or password' });

  res.json({ name: acc.name, phone: acc.phone, email: acc.email });
});

module.exports = router;
