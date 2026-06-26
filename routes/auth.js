const express = require('express');
const crypto  = require('crypto');
const https   = require('https');
const db      = require('../database/db');
const router  = express.Router();

const SALT = 'ibh-2025';
const hash = pw => crypto.createHash('sha256').update(pw + SALT).digest('hex');

function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(accountId) {
  const token   = genToken();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString().replace('T', ' ').split('.')[0];
  db.prepare('INSERT INTO sessions (id, account_id, expires_at) VALUES (?, ?, ?)')
    .run(token, accountId, expires);
  return token;
}

function publicAccount(acc) {
  return { id: acc.id, name: acc.name, phone: acc.phone, email: acc.email, role: acc.role, branch: acc.branch };
}

/* POST /api/auth/register */
router.post('/register', (req, res) => {
  const { name, phone, email = '', password } = req.body;
  if (!name || !phone || !password)
    return res.status(400).json({ error: 'Name, phone and password are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const info = db.prepare(
      'INSERT INTO accounts (name, phone, email, password_hash) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), phone.trim(), email.trim().toLowerCase(), hash(password));
    const acc   = db.prepare('SELECT * FROM accounts WHERE id = ?').get(info.lastInsertRowid);
    const token = createSession(acc.id);
    res.status(201).json({ token, ...publicAccount(acc) });
  } catch {
    res.status(409).json({ error: 'Phone number already registered' });
  }
});

/* POST /api/auth/login — accepts email OR phone */
router.post('/login', (req, res) => {
  const { identifier, phone, password } = req.body;
  const id = (identifier || phone || '').trim();
  if (!id || !password)
    return res.status(400).json({ error: 'Email/phone and password are required' });

  const acc = db.prepare(
    'SELECT * FROM accounts WHERE phone = ? OR LOWER(email) = LOWER(?)'
  ).get(id, id);

  if (!acc || acc.password_hash !== hash(password))
    return res.status(401).json({ error: 'Incorrect email/phone or password' });

  const token = createSession(acc.id);
  res.json({ token, ...publicAccount(acc) });
});

/* POST /api/auth/google — verify Google ID token */
router.post('/google', (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing credential' });

  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  https.get(url, (gRes) => {
    let raw = '';
    gRes.on('data', c => raw += c);
    gRes.on('end', () => {
      try {
        const payload = JSON.parse(raw);
        if (gRes.statusCode !== 200 || payload.error)
          return res.status(401).json({ error: 'Invalid Google credential' });

        const email = (payload.email || '').toLowerCase();
        const name  = payload.name || email.split('@')[0];
        if (!email) return res.status(400).json({ error: 'No email in Google token' });

        let acc = db.prepare('SELECT * FROM accounts WHERE LOWER(email) = ?').get(email);
        if (!acc) {
          /* Auto-create account for first-time Google users */
          const info = db.prepare(
            'INSERT INTO accounts (name, phone, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
          ).run(name, email, email, '', 'customer');
          acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(info.lastInsertRowid);
        }

        const token = createSession(acc.id);
        res.json({ token, ...publicAccount(acc) });
      } catch {
        res.status(500).json({ error: 'Token verification failed' });
      }
    });
  }).on('error', () => res.status(500).json({ error: 'Google API unreachable' }));
});

/* GET /api/auth/me — validate current session */
router.get('/me', (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const acc = db.prepare(`
    SELECT a.id, a.name, a.email, a.phone, a.role, a.branch
    FROM   sessions s
    JOIN   accounts a ON a.id = s.account_id
    WHERE  s.id = ? AND s.expires_at > datetime('now')
  `).get(token);

  if (!acc) return res.status(401).json({ error: 'Session expired or invalid' });
  res.json(acc);
});

/* POST /api/auth/logout */
router.post('/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (token) db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
  res.json({ ok: true });
});

module.exports = router;
