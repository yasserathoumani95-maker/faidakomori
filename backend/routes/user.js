/* ============================================================
   Routes User — /api/user  (requireAuth)
   Profil, notifications, projets personnels
   ============================================================ */

const router = require('express').Router();
const db     = require('../database');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// ── GET /api/user/profile ─────────────────────────────────────
router.get('/profile', async (req, res) => {
  const user = await db.prepare(`
    SELECT id, nom, prenom, email, tel, ile, role, created_at FROM users WHERE id = ?
  `).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  res.json({ user });
});

// ── PATCH /api/user/profile ───────────────────────────────────
router.patch('/profile', async (req, res) => {
  const { nom, prenom, tel, ile } = req.body;
  await db.prepare(`
    UPDATE users SET nom = COALESCE(?, nom), prenom = COALESCE(?, prenom),
                     tel = COALESCE(?, tel), ile = COALESCE(?, ile)
    WHERE id = ?
  `).run(nom || null, prenom || null, tel || null, ile || null, req.user.id);
  const user = await db.prepare(`SELECT id, nom, prenom, email, tel, ile, role FROM users WHERE id = ?`).get(req.user.id);
  res.json({ user });
});

// ── GET /api/user/notifications ───────────────────────────────
router.get('/notifications', async (req, res) => {
  const notifs = await db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30
  `).all(req.user.id);
  res.json({ notifications: notifs });
});

// ── POST /api/user/notifications/read ────────────────────────
router.post('/notifications/read', async (req, res) => {
  await db.prepare(`UPDATE notifications SET lu = 1 WHERE user_id = ?`).run(req.user.id);
  res.json({ success: true });
});

// ── GET /api/user/contributions ───────────────────────────────
router.get('/contributions', async (req, res) => {
  const enriched = await db.prepare(`
    SELECT contributions.*, projects.nom_projet, projects.type
    FROM contributions
    LEFT JOIN projects ON contributions.project_id = projects.id
    WHERE contributions.user_id = ?
    ORDER BY contributions.created_at DESC
  `).all(req.user.id);
  res.json({ contributions: enriched });
});

// ── PATCH /api/user/contributions/:id/recu ────────────────────
router.patch('/contributions/:id/recu', async (req, res) => {
  const contribution = await db.prepare(
    `SELECT * FROM contributions WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.user.id);
  if (!contribution) return res.status(404).json({ error: 'Contribution introuvable.' });
  if (contribution.livraison_status !== 'expedie') {
    return res.status(400).json({ error: 'Impossible de marquer comme reçu : le porteur n\'a pas encore expédié la commande.' });
  }
  await db.prepare(`UPDATE contributions SET livraison_status = 'recu', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(contribution.id);
  res.json({ success: true, message: 'Réception confirmée. Merci !' });
});

// ── GET /api/user/paiement ────────────────────────────────────
router.get('/paiement', async (req, res) => {
  const user = await db.prepare(`SELECT paiement_tel, paiement_banque, paiement_rib FROM users WHERE id = ?`).get(req.user.id);
  res.json({ paiement: user || {} });
});

// ── PATCH /api/user/paiement ──────────────────────────────────
router.patch('/paiement', async (req, res) => {
  const { paiement_tel, paiement_banque, paiement_rib } = req.body;
  await db.prepare(`UPDATE users SET paiement_tel = ?, paiement_banque = ?, paiement_rib = ? WHERE id = ?`)
    .run(paiement_tel || null, paiement_banque || null, paiement_rib || null, req.user.id);
  res.json({ success: true, message: 'Coordonnées de paiement sauvegardées.' });
});

module.exports = router;
