/* ============================================================
   Routes Admin — /api/admin  (requireAdmin middleware)
   Toutes les routes exigent un JWT avec role = 'admin'
   ============================================================ */

const router = require('express').Router();
const db     = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { sendStatutProjet, sendEntretienPlanifie } = require('../utils/mailer');

router.use(requireAdmin);

// ── GET /api/admin/stats ──────────────────────────────────────
router.get('/stats', (req, res) => {
  const totalProjects     = db.prepare(`SELECT COUNT(*) AS n FROM projects`).get().n;
  const pendingProjects   = db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE status IN ('new','review','interview')`).get().n;
  const approvedProjects  = db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE status IN ('approved','published')`).get().n;
  const publishedProjects = db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE status = 'published'`).get().n;
  const totalUsers        = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role != 'admin'`).get().n;
  const totalCollecte     = db.prepare(`SELECT COALESCE(SUM(montant_collecte),0) AS s FROM projects WHERE status = 'published'`).get().s;
  const totalContribs     = db.prepare(`SELECT COUNT(*) AS n FROM contributions`).get().n;
  const newsletter        = db.prepare(`SELECT COUNT(*) AS n FROM newsletter`).get().n;

  res.json({
    totalProjects,
    pendingProjects,
    approvedProjects,
    publishedProjects,
    totalUsers,
    totalCollecte,
    totalContribs,
    newsletter
  });
});

// ── GET /api/admin/projects — tous les projets ───────────────
router.get('/projects', (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const lim = parseInt(limit);
  const off = (parseInt(page) - 1) * lim;

  let sql  = `SELECT p.*, u.nom, u.prenom, u.email, u.tel FROM projects p LEFT JOIN users u ON p.user_id = u.id`;
  const args = [];

  if (status) { sql += ` WHERE p.status = ?`; args.push(status); }
  sql += ` ORDER BY p.created_at DESC LIMIT ${lim} OFFSET ${off}`;

  const projects = db.prepare(sql).all(...args);
  const total    = db.prepare(`SELECT COUNT(*) AS n FROM projects${status ? ' WHERE status = ?' : ''}`).get(...(status ? [status] : [])).n;

  res.json({ projects, total, page: parseInt(page), pages: Math.ceil(total / lim) });
});

// ── GET /api/admin/projects/:id — détail d'un projet ─────────
router.get('/projects/:id', (req, res) => {
  const project = db.prepare(`
    SELECT p.*, u.nom, u.prenom, u.email, u.tel, u.ile
    FROM projects p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
  res.json({ project });
});

// ── POST /api/admin/projects/:id/interview — planifier entretien
router.post('/projects/:id/interview', (req, res) => {
  const { date, heure, type_entretien, lien, duree, notes } = req.body;
  if (!date || !heure) return res.status(400).json({ error: 'Date et heure obligatoires.' });

  const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });

  const interviewData = JSON.stringify({ date, heure, type_entretien, lien, duree, notes });

  db.prepare(`
    UPDATE projects SET status = 'interview', note_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(interviewData, project.id);

  if (project.user_id) {
    const typeLabel = {
      google_meet: 'Google Meet', zoom: 'Zoom',
      whatsapp: 'WhatsApp Video', phone: 'Appel téléphonique', inperson: 'Présentiel (Moroni)'
    }[type_entretien] || type_entretien || 'entretien';

    const dateObj = new Date(date);
    const dateFormatted = dateObj.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    let msg = `🗓️ Entretien planifié pour votre projet "${project.nom_projet}" le ${dateFormatted} à ${heure} via ${typeLabel}.`;
    if (lien) msg += ` Lien : ${lien}`;
    if (notes) msg += ` Notes : ${notes}`;

    db.prepare(`INSERT INTO notifications (user_id, message, lien) VALUES (?, ?, ?)`).run(
      project.user_id, msg, '/mon-espace.html'
    );

    const porteur = db.prepare(`SELECT email, prenom FROM users WHERE id = ?`).get(project.user_id);
    if (porteur) {
      sendEntretienPlanifie({
        to: porteur.email, prenom: porteur.prenom,
        nomProjet: project.nom_projet,
        date, heure, typeEntretien: type_entretien, lien, duree, notes,
      }).catch(() => {});
    }
  }

  res.json({ success: true });
});

// ── PATCH /api/admin/projects/:id/status ─────────────────────
router.patch('/projects/:id/status', (req, res) => {
  const { status, note_admin } = req.body;
  const validStatuses = ['new', 'review', 'interview', 'approved', 'rejected', 'published'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }

  const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });

  db.prepare(`
    UPDATE projects SET status = ?, note_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(status, note_admin || null, project.id);

  // Notifier le porteur (in-app + email)
  if (project.user_id) {
    const messages = {
      review:    `Votre projet "${project.nom_projet}" est en cours d'examen.`,
      interview: `Bonne nouvelle ! Nous souhaitons vous contacter pour votre projet "${project.nom_projet}".`,
      approved:  `Félicitations ! Votre projet "${project.nom_projet}" a été approuvé.`,
      published: `Votre projet "${project.nom_projet}" est maintenant en ligne sur FaidaKomori !`,
      rejected:  `Votre projet "${project.nom_projet}" n'a pas été retenu. ${note_admin ? note_admin : ''}`
    };
    if (messages[status]) {
      db.prepare(`INSERT INTO notifications (user_id, message, lien) VALUES (?, ?, ?)`).run(
        project.user_id, messages[status], `/mon-espace.html`
      );
    }

    const porteur = db.prepare(`SELECT email, prenom FROM users WHERE id = ?`).get(project.user_id);
    if (porteur && ['review','approved','published','rejected'].includes(status)) {
      sendStatutProjet({
        to: porteur.email, prenom: porteur.prenom,
        nomProjet: project.nom_projet,
        status, noteAdmin: note_admin,
      }).catch(() => {});
    }
  }

  res.json({ success: true });
});

// ── GET /api/admin/users ──────────────────────────────────────
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.nom, u.prenom, u.email, u.tel, u.ile, u.role, u.created_at,
           COUNT(p.id) AS nb_projets
    FROM users u
    LEFT JOIN projects p ON p.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();
  res.json({ users });
});

// ── PATCH /api/admin/users/:id/role ──────────────────────────
router.patch('/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide.' });
  }
  db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, req.params.id);
  res.json({ success: true });
});

// ── GET /api/admin/contributions ─────────────────────────────
router.get('/contributions', (req, res) => {
  const contributions = db.prepare(`
    SELECT c.*, p.nom_projet, p.type FROM contributions c
    JOIN projects p ON c.project_id = p.id
    ORDER BY c.created_at DESC LIMIT 100
  `).all();
  res.json({ contributions });
});

// ── GET /api/admin/notifications ─────────────────────────────
router.get('/notifications', (req, res) => {
  const notifs = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30
  `).all(req.user.id);
  res.json({ notifications: notifs });
});

// ── POST /api/admin/newsletter ───────────────────────────────
router.post('/newsletter', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis.' });
  try {
    db.prepare(`INSERT INTO newsletter (email) VALUES (?)`).run(email.toLowerCase());
    res.json({ success: true });
  } catch {
    res.status(409).json({ error: 'Email déjà inscrit.' });
  }
});

// ── GET /api/admin/top-donors ─────────────────────────────────
router.get('/top-donors', (req, res) => {
  // Agrège par utilisateur connecté (user_id) ou par nom saisi, hors anonymes
  const rows = db.prepare(`
    SELECT
      c.user_id,
      COALESCE(u.prenom || ' ' || u.nom, c.nom_contributeur, 'Contributeur') AS nom,
      SUM(c.montant)  AS total,
      COUNT(*)        AS count
    FROM contributions c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.anonyme = 0
    GROUP BY COALESCE(CAST(c.user_id AS TEXT), c.nom_contributeur)
    ORDER BY total DESC
    LIMIT 10
  `).all();
  res.json({ donors: rows });
});

// ── GET /api/admin/versements ─────────────────────────────────
router.get('/versements', (req, res) => {
  const allVersements = db.prepare(`SELECT * FROM versements ORDER BY created_at DESC`).all();
  // Enrichir avec les données projet et utilisateur
  const enriched = allVersements.map(v => {
    const project = db.prepare(`SELECT nom_projet, type, montant_collecte, montant FROM projects WHERE id = ?`).get(v.project_id);
    const user    = db.prepare(`SELECT nom, prenom, email, tel, paiement_tel, paiement_banque, paiement_rib FROM users WHERE id = ?`).get(v.user_id);
    return { ...v, ...(user || {}), ...(project || {}) };
  });
  res.json({ versements: enriched });
});

// ── PATCH /api/admin/versements/:id ──────────────────────────
router.patch('/versements/:id', (req, res) => {
  const { status, note_admin, montant_verse } = req.body;
  const validStatuses = ['approved', 'refused', 'versed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide. Valeurs acceptées : approved, refused, versed.' });
  }

  const allVersements = db.prepare(`SELECT * FROM versements ORDER BY created_at DESC`).all();
  const versement     = allVersements.find(v => v.id == req.params.id);
  if (!versement) return res.status(404).json({ error: 'Demande de versement introuvable.' });

  db.prepare(`UPDATE versements SET status = ?, note_admin = ?, montant_verse = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(status, note_admin || null, parseInt(montant_verse) || versement.montant_demande, parseInt(req.params.id));

  // Notifier le porteur de projet
  const project = db.prepare(`SELECT nom_projet FROM projects WHERE id = ?`).get(versement.project_id);
  const montantFmt = (parseInt(montant_verse) || versement.montant_demande).toLocaleString('fr-FR');
  const messages = {
    approved: `Votre demande de versement pour "${project?.nom_projet}" a été approuvée. Le virement est en préparation.`,
    refused:  `Votre demande de versement pour "${project?.nom_projet}" a été refusée.${note_admin ? ' Motif : ' + note_admin : ''}`,
    versed:   `Votre versement de ${montantFmt} KMF pour "${project?.nom_projet}" a été effectué avec succès !`
  };
  db.prepare(`INSERT INTO notifications (user_id, message, lien) VALUES (?, ?, ?)`)
    .run(versement.user_id, messages[status], `/mon-espace.html`);

  res.json({ success: true });
});

module.exports = router;
