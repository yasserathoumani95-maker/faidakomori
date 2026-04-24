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
router.get('/', (req, res) => {
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

  const projects = db.prepare(sql).all(...args);
  const total    = db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE status = 'published'${type ? ' AND type = ?' : ''}`).get(...(type ? [type] : [])).n;

  res.json({ projects, total, page: parseInt(page), pages: Math.ceil(total / lim) });
});

// ── GET /api/projects/mine — mes projets ─────────────────────
router.get('/mine', requireAuth, (req, res) => {
  const projects = db.prepare(`
    SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC
  `).all(req.user.id);
  res.json({ projects });
});

// ── GET /api/projects/:id — détail ───────────────────────────
router.get('/:id', (req, res) => {
  const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(req.params.id);

  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
  if (project.status !== 'published') return res.status(403).json({ error: 'Ce projet n\'est pas encore publié.' });

  // Enrichir avec les données du porteur via all() qui supporte les JOINs
  const porteurRows = db.prepare(`SELECT nom, prenom, ile, tel FROM users WHERE id = ?`).all(project.user_id);
  const porteur = porteurRows[0];
  if (porteur) {
    project.nom    = porteur.nom;
    project.prenom = porteur.prenom;
    if (!project.ile) project.ile = porteur.ile;
  }

  const contributions = db.prepare(`
    SELECT montant, nom_contributeur, anonyme, message, created_at
    FROM contributions WHERE project_id = ? ORDER BY created_at DESC LIMIT 20
  `).all(project.id);

  res.json({ project, contributions });
});

// ── POST /api/projects — soumettre un projet ─────────────────
router.post('/', requireAuth, (req, res) => {
  const {
    type, nom_projet, description, secteur,
    montant, duree,
    nom, prenom, tel, ile,
    // champs spécifiques
    produit_nom, produit_prix, produit_stock,
    parts_pourcentage, valeur_entreprise
  } = req.body;

  if (!type || !nom_projet) {
    return res.status(400).json({ error: 'Type et nom du projet sont obligatoires.' });
  }

  const result = db.prepare(`
    INSERT INTO projects (user_id, type, nom_projet, description, secteur, montant, duree, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'new')
  `).run(
    req.user.id,
    type,
    nom_projet.trim(),
    description || null,
    secteur || null,
    parseInt(montant) || 0,
    parseInt(duree) || 30
  );

  // Notifier les admins
  const admins = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all();
  const notifStmt = db.prepare(`INSERT INTO notifications (user_id, message, lien) VALUES (?, ?, ?)`);
  admins.forEach(a => {
    notifStmt.run(a.id, `Nouveau projet soumis : "${nom_projet}" (${type})`, `/admin.html#projets`);
  });

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, project });
});

// ── POST /api/projects/:id/contribute ────────────────────────
router.post('/:id/contribute', optionalAuth, (req, res) => {
  const { montant, methode_paiement, message, anonyme, nom_contributeur, coordonnees_paiement } = req.body;
  const project = db.prepare(`SELECT * FROM projects WHERE id = ? AND status = 'published'`).get(req.params.id);

  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
  const montantInt = parseInt(montant);
  if (!montant || isNaN(montantInt) || montantInt <= 0) {
    return res.status(400).json({ error: 'Montant invalide.' });
  }
  if (montantInt > 10_000_000) {
    return res.status(400).json({ error: 'Montant trop élevé. Maximum 10 000 000 KMF par contribution.' });
  }

  const userId = req.user?.id || null;

  // Pour la prévente, initialiser le suivi de livraison
  const livraison_status = project.type === 'prevente' ? 'pending' : null;

  // Pour l'investissement, calculer le % de parts acquis
  // parts_contrib = (montant_investi / objectif_total) × parts_offertes
  let parts_contrib = null;
  if (project.type === 'investissement' && project.parts_pourcentage && project.montant > 0) {
    parts_contrib = Math.round(
      (montantInt / project.montant) * project.parts_pourcentage * 100
    ) / 100; // arrondi 2 décimales
  }

  db.prepare(`
    INSERT INTO contributions (project_id, user_id, nom_contributeur, montant, methode_paiement, message, anonyme, coordonnees_paiement, livraison_status, parts_pourcentage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    project.id, userId, nom_contributeur || null, montantInt,
    methode_paiement || 'mvola', message || null, anonyme ? 1 : 0,
    coordonnees_paiement || null, livraison_status, parts_contrib
  );

  db.prepare(`
    UPDATE projects SET
      montant_collecte = montant_collecte + ?,
      nb_contributeurs = nb_contributeurs + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(montantInt, project.id);

  // Notifier le porteur de projet
  if (project.user_id) {
    const m = anonyme ? 'Un anonyme' : (nom_contributeur || 'Quelqu\'un');
    db.prepare(`INSERT INTO notifications (user_id, message, lien) VALUES (?, ?, ?)`).run(
      project.user_id,
      `${m} a contribué ${montantInt.toLocaleString('fr-FR')} KMF à votre projet "${project.nom_projet}"`,
      `/projet-detail.html?id=${project.id}`
    );
  }

  res.json({ success: true, message: 'Contribution enregistrée avec succès.' });
});

// ── GET /api/projects/:id/contributions-porteur ───────────────
// Le porteur voit toutes les contributions pour gérer les livraisons
router.get('/:id/contributions-porteur', requireAuth, (req, res) => {
  const project = db.prepare(`SELECT * FROM projects WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!project) return res.status(403).json({ error: 'Non autorisé. Vous n\'êtes pas le porteur de ce projet.' });

  const contributions = db.prepare(`SELECT * FROM contributions WHERE project_id = ? ORDER BY created_at DESC`).all(project.id);
  res.json({ contributions, project });
});

// ── PATCH /api/projects/:projectId/contributions/:id/livraison ─
// Le porteur marque une contribution comme "expédiée"
router.patch('/:projectId/contributions/:id/livraison', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!['expedie', 'recu'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide. Valeurs acceptées : expedie, recu.' });
  }

  const project = db.prepare(`SELECT * FROM projects WHERE id = ? AND user_id = ?`).get(req.params.projectId, req.user.id);
  if (!project) return res.status(403).json({ error: 'Non autorisé.' });

  const allContribs = db.prepare(`SELECT * FROM contributions WHERE project_id = ?`).all(project.id);
  const contribution = allContribs.find(c => c.id == req.params.id);
  if (!contribution) return res.status(404).json({ error: 'Contribution introuvable.' });

  db.prepare(`UPDATE contributions SET livraison_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(status, contribution.id);

  // Notifier le contributeur si il a un compte
  if (contribution.user_id && status === 'expedie') {
    db.prepare(`INSERT INTO notifications (user_id, message, lien) VALUES (?, ?, ?)`)
      .run(
        contribution.user_id,
        `Bonne nouvelle ! Votre commande pour le projet "${project.nom_projet}" a été expédiée. Confirmez la réception dans Mon Espace.`,
        `/mon-espace.html`
      );
  }

  res.json({ success: true });
});

// ── GET /api/projects/:id/contributions ──────────────────────
router.get('/:id/contributions', (req, res) => {
  const project = db.prepare(`SELECT id FROM projects WHERE id = ? AND status = 'published'`).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });

  const contributions = db.prepare(`
    SELECT montant, nom_contributeur, anonyme, message, created_at
    FROM contributions WHERE project_id = ?
    ORDER BY created_at DESC
  `).all(project.id);

  res.json({ contributions });
});

// ── POST /api/projects/:id/demande-versement ─────────────────
router.post('/:id/demande-versement', requireAuth, (req, res) => {
  const project = db.prepare(`SELECT * FROM projects WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
  if (project.status !== 'published') {
    return res.status(400).json({ error: 'Le projet doit être publié pour demander un versement.' });
  }

  const { montant_demande, motif } = req.body;
  if (!montant_demande || isNaN(montant_demande) || parseInt(montant_demande) <= 0) {
    return res.status(400).json({ error: 'Montant invalide.' });
  }

  // Vérifier qu'il n'y a pas déjà une demande en attente
  const allVersements = db.prepare(`SELECT * FROM versements WHERE project_id = ?`).all(project.id);
  const pending = allVersements.find(v => v.status === 'pending');
  if (pending) {
    return res.status(409).json({ error: 'Vous avez déjà une demande de versement en attente.' });
  }

  db.prepare(`
    INSERT INTO versements (project_id, user_id, montant_demande, motif, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(project.id, req.user.id, parseInt(montant_demande), motif || null);

  // Notifier les admins
  const admins = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all();
  admins.forEach(a => {
    db.prepare(`INSERT INTO notifications (user_id, message, lien) VALUES (?, ?, ?)`).run(
      a.id,
      `Demande de versement de ${parseInt(montant_demande).toLocaleString('fr-FR')} KMF pour "${project.nom_projet}"`,
      `/admin.html`
    );
  });

  res.status(201).json({ success: true, message: 'Demande de versement envoyée à notre équipe.' });
});

// ── GET /api/projects/:id/versements ─────────────────────────
router.get('/:id/versements', requireAuth, (req, res) => {
  const project = db.prepare(`SELECT * FROM projects WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });

  const versements = db.prepare(`SELECT * FROM versements WHERE project_id = ? ORDER BY created_at DESC`).all(project.id);
  res.json({ versements });
});

// ── POST /api/projects/:id/accept-interview ───────────────────
// L'utilisateur accepte ou refuse l'entretien planifié
router.post('/:id/accept-interview', requireAuth, (req, res) => {
  const { accepted } = req.body; // true = accepté, false = refusé
  const project = db.prepare(`SELECT * FROM projects WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
  if (project.status !== 'interview') return res.status(400).json({ error: 'Aucun entretien en attente.' });

  const reponse = accepted ? 'accepted' : 'refused';
  let noteAdmin = {};
  try { noteAdmin = JSON.parse(project.note_admin || '{}'); } catch {}
  noteAdmin.reponse_porteur = reponse;
  db.prepare(`UPDATE projects SET note_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(JSON.stringify(noteAdmin), project.id);

  // Notifier les admins
  const admins = db.prepare(`SELECT id, email FROM users WHERE role = 'admin'`).all();
  const porteur = db.prepare(`SELECT nom, prenom FROM users WHERE id = ?`).get(req.user.id);
  const porteurNom = porteur ? `${porteur.prenom} ${porteur.nom}` : 'Le porteur';
  const emoji = accepted ? '✅' : '❌';
  const msgAdmin = `${emoji} ${porteurNom} a ${accepted ? 'accepté' : 'refusé'} l'entretien pour le projet "${project.nom_projet}".`;

  admins.forEach(a => {
    db.prepare(`INSERT INTO notifications (user_id, message, lien) VALUES (?, ?, ?)`)
      .run(a.id, msgAdmin, '/admin.html');
  });

  res.json({ success: true });
});

module.exports = router;
