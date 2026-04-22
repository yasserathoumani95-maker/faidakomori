/* ============================================================
   Routes Admin — /api/admin  (requireAdmin middleware)
   Toutes les routes exigent un JWT avec role = 'admin'
   ============================================================ */

const router = require('express').Router();
const db     = require('../database');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

// ── GET /api/admin/stats ──────────────────────────────────────
router.get('/stats', (req, res) => {
  const totalProjects     = db.prepare(`SELECT COUNT(*) AS n FROM projects`).get().n;
  const pendingProjects   = db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE status IN ('new','review','interview')`).get().n;
  const publishedProjects = db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE status = 'published'`).get().n;
  const totalUsers        = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role != 'admin'`).get().n;
  const totalCollecte     = db.prepare(`SELECT COALESCE(SUM(montant_collecte),0) AS s FROM projects WHERE status = 'published'`).get().s;
  const totalContribs     = db.prepare(`SELECT COUNT(*) AS n FROM contributions`).get().n;
  const newsletter        = db.prepare(`SELECT COUNT(*) AS n FROM newsletter`).get().n;

  res.json({
    totalProjects,
    pendingProjects,
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
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let sql  = `SELECT p.*, u.nom, u.prenom, u.email, u.tel FROM projects p LEFT JOIN users u ON p.user_id = u.id`;
  const args = [];

  if (status) { sql += ` WHERE p.status = ?`; args.push(status); }
  sql += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
  args.push(parseInt(limit), offset);

  const projects = db.prepare(sql).all(...args);
  const total    = db.prepare(`SELECT COUNT(*) AS n FROM projects${status ? ' WHERE status = ?' : ''}`).get(...(status ? [status] : [])).n;

  res.json({ projects, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
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

  // Notifier le porteur
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
  const { readDB } = require('../database');
  const data = readDB();

  // Agréger par contributeur (utilisateur connecté ou nom saisi)
  const donorMap = {};

  data.contributions.forEach(c => {
    if (c.anonyme) return; // ne pas compter les anonymes
    const key = c.user_id
      ? `user_${c.user_id}`
      : (c.nom_contributeur || 'Anonyme');

    if (!donorMap[key]) {
      const user = c.user_id ? data.users.find(u => u.id === c.user_id) : null;
      donorMap[key] = {
        nom: user ? `${user.prenom} ${user.nom}` : (c.nom_contributeur || 'Contributeur'),
        total: 0,
        count: 0,
        user_id: c.user_id || null
      };
    }
    donorMap[key].total += parseInt(c.montant) || 0;
    donorMap[key].count += 1;
  });

  const donors = Object.values(donorMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  res.json({ donors });
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
