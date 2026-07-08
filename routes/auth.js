const express = require('express');
const crypto  = require('crypto');
const bcrypt  = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');
const db      = require('../database/db');
const router  = express.Router();

const BCRYPT_ROUNDS = 12;
const googleClient  = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function createSession(accountId) {
  const token   = genToken();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.prepare('INSERT INTO sessions (id, account_id, expires_at) VALUES (?, ?, ?)')
    .run(token, accountId, expires);
  return token;
}

function publicAccount(acc) {
  return { id: acc.id, name: acc.name, phone: acc.phone, email: acc.email, role: acc.role, branch: acc.branch };
}

/* Accounts created via Google sign-in get no usable password.
   A random, never-revealed hash blocks password-login entirely
   instead of leaving a guessable empty-string hash on the row. */
function unusablePasswordHash() {
  return bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
}

/* POST /api/auth/register */
router.post('/register', async (req, res) => {
  const { name, phone, email = '', password } = req.body;
  if (!name || !phone || !password)
    return res.status(400).json({ error: 'Name, phone and password are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return res.status(400).json({ error: 'Please enter a valid email address' });

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const info = await db.prepare(
      'INSERT INTO accounts (name, phone, email, password_hash) VALUES (?, ?, ?, ?) RETURNING id'
    ).run(name.trim(), phone.trim(), email.trim().toLowerCase(), passwordHash);
    const acc   = await db.prepare('SELECT * FROM accounts WHERE id = ?').get(info.rows[0].id);
    const token = await createSession(acc.id);
    res.status(201).json({ token, ...publicAccount(acc) });
  } catch {
    res.status(409).json({ error: 'Phone number already registered' });
  }
});

/* POST /api/auth/login — accepts email OR phone */
router.post('/login', async (req, res) => {
  const { identifier, phone, password } = req.body;
  const id = (identifier || phone || '').trim();
  if (!id || !password)
    return res.status(400).json({ error: 'Email/phone and password are required' });

  const acc = await db.prepare(
    'SELECT * FROM accounts WHERE phone = ? OR LOWER(email) = LOWER(?)'
  ).get(id, id);

  // Always run a bcrypt compare, even on a missing account, so response
  // timing doesn't reveal whether the identifier exists.
  const hashToCheck = acc ? acc.password_hash : unusablePasswordHash();
  const valid = await bcrypt.compare(password, hashToCheck);

  if (!acc || !valid)
    return res.status(401).json({ error: 'Incorrect email/phone or password' });

  const token = await createSession(acc.id);
  res.json({ token, ...publicAccount(acc) });
});

/* POST /api/auth/google — verify Google ID token server-side */
router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing credential' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = (payload.email || '').toLowerCase();
    const name  = payload.name || email.split('@')[0];
    if (!email) return res.status(400).json({ error: 'No email in Google token' });

    let acc = await db.prepare('SELECT * FROM accounts WHERE LOWER(email) = ?').get(email);
    if (!acc) {
      const info = await db.prepare(
        'INSERT INTO accounts (name, phone, email, password_hash, role) VALUES (?, ?, ?, ?, ?) RETURNING id'
      ).run(name, email, email, unusablePasswordHash(), 'customer');
      acc = await db.prepare('SELECT * FROM accounts WHERE id = ?').get(info.rows[0].id);
    }

    const token = await createSession(acc.id);
    res.json({ token, ...publicAccount(acc) });
  } catch {
    res.status(401).json({ error: 'Invalid Google credential' });
  }
});

/* GET /api/auth/me — validate current session */
router.get('/me', async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const acc = await db.prepare(`
    SELECT a.id, a.name, a.email, a.phone, a.role, a.branch
    FROM   sessions s
    JOIN   accounts a ON a.id = s.account_id
    WHERE  s.id = ? AND s.expires_at > NOW()
  `).get(token);

  if (!acc) return res.status(401).json({ error: 'Session expired or invalid' });
  res.json(acc);
});

/* POST /api/auth/logout */
router.post('/logout', async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (token) await db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
  res.json({ ok: true });
});

module.exports = router;
