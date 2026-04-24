/* ============================================================
   Routes Auth — /api/auth
   POST /register   POST /login   GET /me   POST /logout
   ============================================================ */

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const db      = require('../database');
const { signToken, JWT_SECRET, isValidEmail } = require('../utils/auth');
const { sendWelcome, sendResetPassword } = require('../utils/mailer');

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

  sendWelcome({ to: user.email, prenom: user.prenom }).catch(() => {});

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

// ── POST /api/auth/forgot-password ───────────────────────────
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  // Répondre toujours success (sécurité : ne pas révéler si l'email existe)
  if (!user) {
    return res.json({ success: true });
  }

  const token   = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // expire dans 1h

  db.prepare(`UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?`)
    .run(token, expires, user.id);

  const resetUrl = `/reset-password.html?token=${token}`;
  sendResetPassword({ to: user.email, prenom: user.prenom, resetUrl }).catch(() => {});
  res.json({ success: true });
});

// ── POST /api/auth/reset-password ────────────────────────────
router.post('/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token et mot de passe requis.' });
  if (password.length < 8) return res.status(400).json({ error: 'Minimum 8 caractères.' });

  const user = db.prepare(`SELECT * FROM users WHERE reset_token = ?`).get(token);
  if (!user || !user.reset_token_expires) {
    return res.status(400).json({ error: 'Lien invalide ou déjà utilisé.' });
  }
  if (new Date(user.reset_token_expires) < new Date()) {
    return res.status(400).json({ error: 'Ce lien a expiré. Faites une nouvelle demande.' });
  }

  const hash = bcrypt.hashSync(password, 12);
  db.prepare(`UPDATE users SET password_hash = ?, reset_token = ?, reset_token_expires = ? WHERE id = ?`)
    .run(hash, null, null, user.id);

  res.json({ success: true, message: 'Mot de passe réinitialisé avec succès !' });
});

module.exports = router;
