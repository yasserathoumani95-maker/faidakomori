/* ============================================================
   Routes User — /api/user  (requireAuth)
   Profil, notifications, projets personnels
   ============================================================ */

const router = require('express').Router();
const db     = require('../database');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// ── GET /api/user/profile ─────────────────────────────────────
router.get('/profile', (req, res) => {
  const user = db.prepare(`
    SELECT id, nom, prenom, email, tel, ile, role, created_at FROM users WHERE id = ?
  `).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  res.json({ user });
});

// ── PATCH /api/user/profile ───────────────────────────────────
router.patch('/profile', (req, res) => {
  const { nom, prenom, tel, ile } = req.body;
  db.prepare(`
    UPDATE users SET nom = COALESCE(?, nom), prenom = COALESCE(?, prenom),
                     tel = COALESCE(?, tel), ile = COALESCE(?, ile)
    WHERE id = ?
  `).run(nom || null, prenom || null, tel || null, ile || null, req.user.id);
  const user = db.prepare(`SELECT id, nom, prenom, email, tel, ile, role FROM users WHERE id = ?`).get(req.user.id);
  res.json({ user });
});

// ── GET /api/user/notifications ───────────────────────────────
router.get('/notifications', (req, res) => {
  const notifs = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30
  `).all(req.user.id);
  res.json({ notifications: notifs });
});

// ── POST /api/user/notifications/read ────────────────────────
router.post('/notifications/read', (req, res) => {
  db.prepare(`UPDATE notifications SET lu = 1 WHERE user_id = ?`).run(req.user.id);
  res.json({ success: true });
});

// ── GET /api/user/contributions ───────────────────────────────
router.get('/contributions', (req, res) => {
  // NOTE: filterRows ne gère pas les alias de table (c.user_id) → WHERE sans préfixe
  const enriched = db.prepare(`
    SELECT * FROM contributions
    LEFT JOIN projects ON contributions.project_id = projects.id
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.user.id);
  res.json({ contributions: enriched });
});

// ── PATCH /api/user/contributions/:id/recu ────────────────────
router.patch('/contributions/:id/recu', (req, res) => {
  const contribution = db.prepare(
    `SELECT * FROM contributions WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user.id);
  if (!contribution) return res.status(404).json({ error: 'Contribution introuvable.' });
  if (contribution.livraison_status !== 'expedie') {
    return res.status(400).json({ error: 'Impossible de marquer comme reçu : le porteur n\'a pas encore expédié la commande.' });
  }
  db.prepare(`UPDATE contributions SET livraison_status = 'recu', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(contribution.id);
  res.json({ success: true, message: 'Réception confirmée. Merci !' });
});

// ── GET /api/user/paiement ────────────────────────────────────
router.get('/paiement', (req, res) => {
  const user = db.prepare(`SELECT paiement_tel, paiement_banque, paiement_rib FROM users WHERE id = ?`).get(req.user.id);
  res.json({ paiement: user || {} });
});

// ── PATCH /api/user/paiement ──────────────────────────────────
router.patch('/paiement', (req, res) => {
  const { paiement_tel, paiement_banque, paiement_rib } = req.body;
  db.prepare(`UPDATE users SET paiement_tel = ?, paiement_banque = ?, paiement_rib = ? WHERE id = ?`)
    .run(paiement_tel || null, paiement_banque || null, paiement_rib || null, req.user.id);
  res.json({ success: true, message: 'Coordonnées de paiement sauvegardées.' });
});

module.exports = router;
