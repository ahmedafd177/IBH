const db = require('../database/db');

async function _getSession(token) {
  if (!token) return null;
  return db.prepare(`
    SELECT a.id, a.name, a.email, a.phone, a.role, a.branch
    FROM   sessions s
    JOIN   accounts a ON a.id = s.account_id
    WHERE  s.id = ? AND s.expires_at > NOW()
  `).get(token);
}

function _token(req) {
  return (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

/* Hard auth — blocks if not authenticated or wrong role */
function requireAuth(roles = []) {
  return async (req, res, next) => {
    try {
      const acc = await _getSession(_token(req));
      if (!acc) return res.status(401).json({ error: 'Not authenticated' });
      if (roles.length && !roles.includes(acc.role))
        return res.status(403).json({ error: 'Insufficient permissions' });
      req.account = acc;
      next();
    } catch (e) {
      res.status(500).json({ error: 'Authentication check failed' });
    }
  };
}

/* Soft auth — attaches req.account if valid token present, never blocks */
async function softAuth(req, res, next) {
  try {
    const acc = await _getSession(_token(req));
    if (acc) req.account = acc;
  } catch (e) { /* treat as unauthenticated */ }
  next();
}

module.exports = { requireAuth, softAuth };
