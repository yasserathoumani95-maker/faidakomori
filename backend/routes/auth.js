/* ============================================================
   Routes Auth — /api/auth
   POST /register   POST /login   GET /me   POST /logout
   ============================================================ */

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../database');
const { signToken, JWT_SECRET, isValidEmail } = require('../utils/auth');

// ── POST /api/auth/register ───────────────────────────────────
router.post('/register', (req, res) => {
  const { nom, prenom, email, password, tel, ile } = req.body;

  if (!nom || !prenom || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Cette adresse email est déjà utilisée.' });
  }

  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare(`
    INSERT INTO users (nom, prenom, email, password_hash, role, tel, ile)
    VALUES (?, ?, ?, ?, 'user', ?, ?)
  `).run(nom.trim(), prenom.trim(), email.toLowerCase(), hash, tel || null, ile || null);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = signToken(user);

  res.status(201).json({
    token,
    user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role }
  });
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role }
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', (req, res) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const user    = db.prepare('SELECT id, nom, prenom, email, tel, ile, role, created_at FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Token invalide.' });
  }
});

// ── POST /api/auth/change-password ───────────────────────────
router.post('/change-password', (req, res) => {
  const { requireAuth } = require('../middleware/auth');
  const { ancien, nouveau } = req.body;
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Non authentifié.' });
  try {
    const jwt = require('jsonwebtoken');
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!bcrypt.compareSync(ancien, user.password_hash)) {
      return res.status(400).json({ error: 'Ancien mot de passe incorrect.' });
    }
    if (!nouveau || nouveau.length < 8) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 8 caractères.' });
    }
    const hash = bcrypt.hashSync(nouveau, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, payload.id);
    res.json({ success: true });
  } catch {
    res.status(401).json({ error: 'Token invalide.' });
  }
});

module.exports = router;
