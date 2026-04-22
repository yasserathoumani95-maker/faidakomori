/* ============================================================
   Middleware JWT — vérifie le token dans Authorization header
   ============================================================ */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../utils/auth');

function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant ou invalide.' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token expiré ou invalide.' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    next();
  });
}

/**
 * Middleware optionnel — injecte req.user si token présent et valide,
 * sinon laisse passer sans bloquer (req.user reste undefined).
 */
function optionalAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
    } catch {
      // token invalide → on ignore silencieusement
    }
  }
  next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth };
