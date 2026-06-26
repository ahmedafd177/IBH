const db = require('../database/db');

function _getSession(token) {
  if (!token) return null;
  return db.prepare(`
    SELECT a.id, a.name, a.email, a.phone, a.role, a.branch
    FROM   sessions s
    JOIN   accounts a ON a.id = s.account_id
    WHERE  s.id = ? AND s.expires_at > datetime('now')
  `).get(token);
}

function _token(req) {
  return (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

/* Hard auth — blocks if not authenticated or wrong role */
function requireAuth(roles = []) {
  return (req, res, next) => {
    const acc = _getSession(_token(req));
    if (!acc) return res.status(401).json({ error: 'Not authenticated' });
    if (roles.length && !roles.includes(acc.role))
      return res.status(403).json({ error: 'Insufficient permissions' });
    req.account = acc;
    next();
  };
}

/* Soft auth — attaches req.account if valid token present, never blocks */
function softAuth(req, res, next) {
  const acc = _getSession(_token(req));
  if (acc) req.account = acc;
  next();
}

module.exports = { requireAuth, softAuth };
