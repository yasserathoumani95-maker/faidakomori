/* ============================================================
   Route Déposer — POST /api/deposer
   Crée ou connecte un compte ET soumet le projet en une seule requête.
   Permet au porteur de projet de tout faire en un seul formulaire.
   ============================================================ */

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const db      = require('../database');
const { signToken, isValidEmail } = require('../utils/auth');
const { sendProjetRecu, sendAdminNouveauProjet } = require('../utils/mailer');

// ── POST /api/deposer ─────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    // Compte
    action,           // 'register' | 'login'
    email, password,
    // Infos perso (pour nouveau compte)
    nom, prenom, tel, ile,
    // Projet
    type, nom_projet, description, secteur, montant, duree,
    budget_lien, budget_description,
    // Champs spécifiques type
    contrepartie, parts_pourcentage, valeur_entreprise, impact, entreprise
  } = req.body;

  // ── Validation minimale ──────────────────────────────────
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }
  if (!type || !nom_projet) {
    return res.status(400).json({ error: 'Type et nom du projet sont obligatoires.' });
  }

  let user;
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());

  if (existing) {
    // ── Email déjà utilisé → vérifier mot de passe ──────
    const valid = bcrypt.compareSync(password, existing.password_hash);
    if (!valid) {
      return res.status(401).json({
        error: 'Ce compte existe déjà. Mot de passe incorrect.',
        code:  'EMAIL_EXISTS'
      });
    }
    user = existing;
    // Mettre à jour le profil si nouvelles infos fournies
    if (nom || prenom || tel || ile) {
      db.prepare(`UPDATE users SET
        nom = COALESCE(?, nom), prenom = COALESCE(?, prenom),
        tel = COALESCE(?, tel), ile = COALESCE(?, ile)
        WHERE id = ?`).run(nom || null, prenom || null, tel || null, ile || null, user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }
  } else {
    // ── Nouveau compte → inscription ─────────────────────
    if (!nom || !prenom) {
      return res.status(400).json({ error: 'Nom et prénom sont obligatoires pour créer un compte.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }
    const hash   = bcrypt.hashSync(password, 12);
    const result = db.prepare(`
      INSERT INTO users (nom, prenom, email, password_hash, role, tel, ile)
      VALUES (?, ?, ?, ?, 'user', ?, ?)
    `).run(nom.trim(), prenom.trim(), email.toLowerCase(), hash, tel || null, ile || null);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  }

  // ── Créer le projet lié à ce compte ─────────────────────
  const projResult = db.prepare(`
    INSERT INTO projects
      (user_id, type, nom_projet, description, secteur, montant, duree,
       budget_lien, budget_description,
       parts_pourcentage, valeur_entreprise,
       status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
  `).run(
    user.id,
    type,
    nom_projet.trim(),
    description                      || null,
    secteur                          || null,
    parseInt(montant)                || 0,
    parseInt(duree)                  || 30,
    budget_lien                      || null,
    budget_description               || null,
    parseFloat(parts_pourcentage)    || null,
    parseInt(valeur_entreprise)      || null
  );

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projResult.lastInsertRowid);

  // ── Notifier les admins ──────────────────────────────────
  const admins = db.prepare(`SELECT id, email FROM users WHERE role = 'admin'`).all();
  admins.forEach(a => {
    db.prepare(`INSERT INTO notifications (user_id, message, lien) VALUES (?, ?, ?)`)
      .run(
        a.id,
        `Nouveau projet : "${nom_projet}" (${type}) — ${user.prenom} ${user.nom}`,
        `/admin.html`
      );
    sendAdminNouveauProjet({
      to: a.email,
      nomProjet: nom_projet,
      porteurNom: `${user.prenom} ${user.nom}`,
      type,
      montant,
    }).catch(() => {});
  });

  // ── Email de confirmation au porteur ─────────────────────
  sendProjetRecu({ to: user.email, prenom: user.prenom, nomProjet: nom_projet, type }).catch(() => {});

  // ── Retourner token + user + projet ─────────────────────
  const token = signToken(user);
  res.status(201).json({
    success: true,
    token,
    user:    { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role },
    project
  });
});

module.exports = router;
