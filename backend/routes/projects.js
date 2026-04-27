/* ============================================================
   Routes Projects — /api/projects
   GET /              Liste publique (publiés)
   GET /:id           Détail public
   POST /             Soumettre un projet (auth requis)
   GET /mine          Mes projets (auth requis)
   POST /:id/contribute  Contribuer à un projet
   ============================================================ */

const router      = require('express').Router();
const db          = require('../database');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// ── GET /api/projects — liste publique ───────────────────────
router.get('/', async (req, res) => {
  const { type, page = 1, limit = 12 } = req.query;
  const lim = parseInt(limit);
  const off = (parseInt(page) - 1) * lim;

  let sql    = `SELECT p.*, u.nom, u.prenom FROM projects p LEFT JOIN users u ON p.user_id = u.id WHERE p.status = 'published'`;
  const args = [];

  if (type && ['prevente', 'dons', 'investissement'].includes(type)) {
    sql += ` AND p.type = ?`;
    args.push(type);
  }

  sql += ` ORDER BY p.created_at DESC LIMIT ${lim} OFFSET ${off}`;

  const projects = await db.prepare(sql).all(...args);
  const countRow = await db.prepare(
    `SELECT COUNT(*) AS n FROM projects WHERE status = 'published'${type ? ' AND type = ?' : ''}`
  ).get(...(type ? [type] : []));
  const total = countRow?.n || 0;

  res.json({ projects, total, page: parseInt(page), pages: Math.ceil(total / lim) });
});

// ── GET /api/projects/mine — mes projets ─────────────────────
router.get('/mine', requireAuth, async (req, res) => {
  const projects = await db.prepare(`
    SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC
  `).all(req.user.id);
  res.json({ projects });
});

// ── GET /api/projects/:id — détail ───────────────────────────
router.get('/:id', async (req, res) => {
  const project = await db.prepare(`SELECT * FROM projects WHERE id = ?`).get(req.params.id);

  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
  if (project.status !== 'published') return res.status(403).json({ error: 'Ce projet n\'est pas encore publié.' });

  const porteurRows = await db.prepare(`SELECT nom, prenom, ile, tel FROM users WHERE id = ?`).all(project.user_id);
  const porteur = porteurRows[0];
  if (porteur) {
    project.nom    = porteur.nom;
    project.prenom = porteur.prenom;
    if (!project.ile) project.ile = porteur.ile;
  }

  const contributions = await db.prepare(`
    SELECT montant, nom_contributeur, anonyme, message, created_at
    FROM contributions WHERE project_id = ? ORDER BY created_at DESC LIMIT 20
  `).all(project.id);

  res.json({ project, contributions });
});

// ── POST /api/projects — soumettre un projet ─────────────────
router.post('/', requireAuth, async (req, res) => {
  const {
    type, nom_projet, description, secteur,
    montant, duree,
    nom, prenom, tel, ile,
    parts_pourcentage, valeur_entreprise
  } = req.body;

  if (!type || !nom_projet) {
    return res.status(400).json({ error: 'Type et nom du projet sont obligatoires.' });
  }

  // Mettre à jour tel/ile du porteur si fournis
  if (tel || ile) {
    const u = await db.prepare(`SELECT tel, ile FROM users WHERE id = ?`).get(req.user.id);
    await db.prepare(`UPDATE users SET tel = ?, ile = ? WHERE id = ?`)
      .run(tel || (u && u.tel), ile || (u && u.ile), req.user.id);
  }

  const result = await db.prepare(`
    INSERT INTO projects (user_id, type, nom_projet, description, secteur, montant, duree, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'new')
  `).run(
    req.user.id, type, nom_projet.trim(),
    description || null, secteur || null,
    parseInt(montant) || 0, parseInt(duree) || 30
  );

  // Notifier les admins
  const admins = await db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all();
  for (const a of admins) {
    await db.prepare(`INSERT INTO notifications (user_id, message, lien) VALUES (?, ?, ?)`)
      .run(a.id, `Nouveau projet soumis : "${nom_projet}" (${type})`, `/admin.html#projets`);
  }

  const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, project });
});

// ── Générer une référence unique FK-YYYY-XXXXXX ──────────────
function generateReference() {
  const year  = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0,O,1,I pour éviter confusion
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `FK-${year}-${code}`;
}

// ── POST /api/projects/:id/contribute ────────────────────────
router.post('/:id/contribute', optionalAuth, async (req, res) => {
  const { montant, methode_paiement, message, anonyme, nom_contributeur, coordonnees_paiement } = req.body;
  const project = await db.prepare(`SELECT * FROM projects WHERE id = ? AND status = 'published'`).get(req.params.id);

  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
  const montantInt = parseInt(montant);
  if (!montant || isNaN(montantInt) || montantInt <= 0) {
    return res.status(400).json({ error: 'Montant invalide.' });
  }
  if (montantInt > 10_000_000) {
    return res.status(400).json({ error: 'Montant trop élevé. Maximum 10 000 000 KMF par contribution.' });
  }

  const userId          = req.user?.id || null;
  const livraison_status = project.type === 'prevente' ? 'pending' : null;
  const reference        = generateReference();

  let parts_contrib = null;
  if (project.type === 'investissement' && project.parts_pourcentage && project.montant > 0) {
    parts_contrib = Math.round((montantInt / project.montant) * project.parts_pourcentage * 100) / 100;
  }

  await db.prepare(`
    INSERT INTO contributions
      (project_id, user_id, nom_contributeur, montant, methode_paiement, message,
       anonyme, coordonnees_paiement, livraison_status, parts_pourcentage,
       statut_paiement, reference)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_attente', ?)
  `).run(
    project.id, userId, nom_contributeur || null, montantInt,
    methode_paiement || 'huri', message || null, anonyme ? 1 : 0,
    coordonnees_paiement || null, livraison_status, parts_contrib,
    reference
  );

  // Mettre à jour les compteurs du projet (comptabilité optimiste)
  await db.prepare(`
    UPDATE projects SET
      montant_collecte = montant_collecte + ?,
      nb_contributeurs = nb_contributeurs + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(montantInt, project.id);

  // Notifier le porteur de projet avec les coordonnées de paiement
  if (project.user_id) {
    const who   = anonyme ? 'Un anonyme' : (nom_contributeur || 'Quelqu\'un');
    const methL = { huri:'Huri Money', mpesa:'M-Pesa', virement:'Virement bancaire', mvola:'MoVola' }[methode_paiement] || methode_paiement || '';
    const msg   = `💰 ${who} souhaite ${project.type === 'investissement' ? 'investir' : (project.type === 'prevente' ? 'précommander' : 'donner')} ${montantInt.toLocaleString('fr-FR')} KMF` +
                  ` pour "${project.nom_projet}" via ${methL}. Ref: ${reference}.` +
                  (coordonnees_paiement ? ` Contactez-le au : ${coordonnees_paiement}` : '');
    await db.prepare(`INSERT INTO notifications (user_id, message, lien) VALUES (?, ?, ?)`).run(
      project.user_id, msg, `/admin.html#paiements`
    );
  }

  // Notifier les admins (pour validation)
  const admins = await db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all();
  for (const a of admins) {
    await db.prepare(`INSERT INTO notifications (user_id, message, lien) VALUES (?, ?, ?)`).run(
      a.id,
      `📥 Nouvelle contribution ${montantInt.toLocaleString('fr-FR')} KMF — "${project.nom_projet}" (${reference})`,
      `/admin.html#paiements`
    );
  }

  res.json({ success: true, reference, message: 'Contribution enregistrée avec succès.' });
});

// ── GET /api/projects/:id/contributions-porteur ───────────────
router.get('/:id/contributions-porteur', requireAuth, async (req, res) => {
  const project = await db.prepare(`SELECT * FROM projects WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!project) return res.status(403).json({ error: 'Non autorisé. Vous n\'êtes pas le porteur de ce projet.' });

  const contributions = await db.prepare(`SELECT * FROM contributions WHERE project_id = ? ORDER BY created_at DESC`).all(project.id);
  res.json({ contributions, project });
});

// ── PATCH /api/projects/:projectId/contributions/:id/livraison ─
router.patch('/:projectId/contributions/:id/livraison', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!['expedie', 'recu'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide. Valeurs acceptées : expedie, recu.' });
  }

  const project = await db.prepare(`SELECT * FROM projects WHERE id = ? AND user_id = ?`).get(req.params.projectId, req.user.id);
  if (!project) return res.status(403).json({ error: 'Non autorisé.' });

  const contribution = await db.prepare(`SELECT * FROM contributions WHERE id = ? AND project_id = ?`).get(req.params.id, project.id);
  if (!contribution) return res.status(404).json({ error: 'Contribution introuvable.' });

  await db.prepare(`UPDATE contributions SET livraison_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(status, contribution.id);

  if (contribution.user_id && status === 'expedie') {
    await db.prepare(`INSERT INTO notifications (user_id, message, lien) VALUES (?, ?, ?)`)
      .run(
        contribution.user_id,
        `Bonne nouvelle ! Votre commande pour le projet "${project.nom_projet}" a été expédiée. Confirmez la réception dans Mon Espace.`,
        `/mon-espace.html`
      );
  }

  res.json({ success: true });
});

// ── GET /api/projects/:id/contributions ──────────────────────
router.get('/:id/contributions', async (req, res) => {
  const project = await db.prepare(`SELECT id FROM projects WHERE id = ? AND status = 'published'`).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });

  const contributions = await db.prepare(`
    SELECT montant, nom_contributeur, anonyme, message, created_at
    FROM contributions WHERE project_id = ?
    ORDER BY created_at DESC
  `).all(project.id);

  res.json({ contributions });
});

// ── POST /api/projects/:id/demande-versement ─────────────────
router.post('/:id/demande-versement', requireAuth, async (req, res) => {
  const project = await db.prepare(`SELECT * FROM projects WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
  if (project.status !== 'published') {
    return res.status(400).json({ error: 'Le projet doit être publié pour demander un versement.' });
  }

  const { montant_demande, motif } = req.body;
  if (!montant_demande || isNaN(montant_demande) || parseInt(montant_demande) <= 0) {
    return res.status(400).json({ error: 'Montant invalide.' });
  }

  // Vérifier pas de demande pending
  const pending = await db.prepare(`SELECT id FROM versements WHERE project_id = ? AND status = 'pending' LIMIT 1`).get(project.id);
  if (pending) {
    return res.status(409).json({ error: 'Vous avez déjà une demande de versement en attente.' });
  }

  await db.prepare(`
    INSERT INTO versements (project_id, user_id, montant_demande, motif, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(project.id, req.user.id, parseInt(montant_demande), motif || null);

  // Notifier les admins
  const admins = await db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all();
  for (const a of admins) {
    await db.prepare(`INSERT INTO notifications (user_id, message, lien) VALUES (?, ?, ?)`).run(
      a.id,
      `Demande de versement de ${parseInt(montant_demande).toLocaleString('fr-FR')} KMF pour "${project.nom_projet}"`,
      `/admin.html`
    );
  }

  res.status(201).json({ success: true, message: 'Demande de versement envoyée à notre équipe.' });
});

// ── GET /api/projects/:id/versements ─────────────────────────
router.get('/:id/versements', requireAuth, async (req, res) => {
  const project = await db.prepare(`SELECT * FROM projects WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });

  const versements = await db.prepare(`SELECT * FROM versements WHERE project_id = ? ORDER BY created_at DESC`).all(project.id);
  res.json({ versements });
});

// ── POST /api/projects/:id/accept-interview ───────────────────
router.post('/:id/accept-interview', requireAuth, async (req, res) => {
  const { accepted } = req.body;
  const project = await db.prepare(`SELECT * FROM projects WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
  if (project.status !== 'interview') return res.status(400).json({ error: 'Aucun entretien en attente.' });

  const reponse = accepted ? 'accepted' : 'refused';
  let noteAdmin = {};
  try { noteAdmin = JSON.parse(project.note_admin || '{}'); } catch {}
  noteAdmin.reponse_porteur = reponse;

  await db.prepare(`UPDATE projects SET note_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(JSON.stringify(noteAdmin), project.id);

  // Notifier les admins
  const admins  = await db.prepare(`SELECT id, email FROM users WHERE role = 'admin'`).all();
  const porteur = await db.prepare(`SELECT nom, prenom FROM users WHERE id = ?`).get(req.user.id);
  const porteurNom = porteur ? `${porteur.prenom} ${porteur.nom}` : 'Le porteur';
  const emoji  = accepted ? '✅' : '❌';
  const msgAdmin = `${emoji} ${porteurNom} a ${accepted ? 'accepté' : 'refusé'} l'entretien pour le projet "${project.nom_projet}".`;

  for (const a of admins) {
    await db.prepare(`INSERT INTO notifications (user_id, message, lien) VALUES (?, ?, ?)`)
      .run(a.id, msgAdmin, '/admin.html');
  }

  res.json({ success: true });
});

module.exports = router;
