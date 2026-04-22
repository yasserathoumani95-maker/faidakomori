/* ============================================================
   FaidaKomori — db-local.js
   Base de données locale (localStorage) — fonctionne sans Node.js
   Remplacée automatiquement par api.js quand le backend tourne
   ============================================================ */

const DB_LOCAL = (() => {

  const KEYS = {
    users:         'fk_db_users',
    projects:      'fk_db_projects',
    contributions: 'fk_db_contributions',
    newsletter:    'fk_db_newsletter',
    notifications: 'fk_db_notifications',
  };

  function read(key)       { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
  function write(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  let _idCounters = JSON.parse(localStorage.getItem('fk_id_counters') || '{}');
  function nextId(table) {
    _idCounters[table] = (_idCounters[table] || 0) + 1;
    localStorage.setItem('fk_id_counters', JSON.stringify(_idCounters));
    return _idCounters[table];
  }

  /* ── Seed : données de démonstration ───────────────────── */
  function seed() {
    if (read(KEYS.projects).length > 0) return; // déjà initialisé

    const now = new Date().toISOString();
    write(KEYS.users, [{
      id: 1, nom: 'Admin', prenom: 'FaidaKomori',
      email: 'admin@faidakomori.km',
      password: 'Admin@FK2024!',
      role: 'admin', tel: '', ile: 'Grande Comore',
      created_at: now
    }]);

    write(KEYS.projects, [
      {
        id: 1, user_id: null, type: 'prevente',
        nom_projet: 'Les Épices de Ngazidja',
        description: 'Vente anticipée de notre collection d\'épices bio des Comores : clou de girofle, vanille et ylang-ylang cultivés à la main.',
        secteur: 'Agroalimentaire', montant: 1500000,
        montant_collecte: 1080000, nb_contributeurs: 43,
        duree: 45, status: 'published',
        created_at: now, updated_at: now,
        nom: 'Saïd', prenom: 'Mkiwa'
      },
      {
        id: 2, user_id: null, type: 'dons',
        nom_projet: 'École Numérique de Mutsamudu',
        description: 'Équiper 3 salles de classe en tablettes et connexion internet pour 200 élèves d\'Anjouan.',
        secteur: 'Éducation', montant: 2000000,
        montant_collecte: 650000, nb_contributeurs: 89,
        duree: 60, status: 'published',
        created_at: now, updated_at: now,
        nom: 'Fatima', prenom: 'Abdallah'
      },
      {
        id: 3, user_id: null, type: 'investissement',
        nom_projet: 'FerryConnect — Transport inter-îles',
        description: 'Première navette quotidienne reliant les 3 îles avec une capacité de 80 passagers.',
        secteur: 'Transport', montant: 8000000,
        montant_collecte: 3200000, nb_contributeurs: 17,
        duree: 90, status: 'published',
        created_at: now, updated_at: now,
        nom: 'Omar', prenom: 'Soulaimane'
      },
      {
        id: 4, user_id: null, type: 'prevente',
        nom_projet: 'Batik Comorien — Prêt-à-porter',
        description: 'Ligne de vêtements upcyclés avec des tissus traditionnels comoriens.',
        secteur: 'Mode & Artisanat', montant: 800000,
        montant_collecte: 240000, nb_contributeurs: 12,
        duree: 30, status: 'published',
        created_at: now, updated_at: now,
        nom: 'Amina', prenom: 'Combo'
      },
    ]);

    write(KEYS.contributions, []);
    write(KEYS.newsletter, []);
    write(KEYS.notifications, []);
  }

  seed();

  /* ── Helpers ─────────────────────────────────────────────── */
  function hashSimple(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return 'hash_' + Math.abs(h).toString(36);
  }

  /* ── Auth ────────────────────────────────────────────────── */
  const auth = {
    register({ nom, prenom, email, password, tel = '', ile = '' }) {
      const users = read(KEYS.users);
      if (users.find(u => u.email === email.toLowerCase())) {
        return Promise.reject({ status: 409, message: 'Email déjà utilisé.' });
      }
      if (!nom || !prenom || !email || !password) {
        return Promise.reject({ status: 400, message: 'Champs obligatoires manquants.' });
      }
      if (password.length < 8) {
        return Promise.reject({ status: 400, message: 'Mot de passe trop court (min. 8 caractères).' });
      }
      const user = {
        id: nextId('users'), nom, prenom,
        email: email.toLowerCase(), password,
        tel, ile, role: 'user',
        created_at: new Date().toISOString()
      };
      users.push(user);
      write(KEYS.users, users);
      const token = btoa(JSON.stringify({ id: user.id, email: user.email, role: user.role, nom: user.nom, prenom: user.prenom, exp: Date.now() + 7*24*3600*1000 }));
      return Promise.resolve({ token, user: { id: user.id, nom, prenom, email: user.email, role: user.role } });
    },

    login(email, password) {
      const users = read(KEYS.users);
      const user  = users.find(u => u.email === email.toLowerCase() && u.password === password);
      if (!user) return Promise.reject({ status: 401, message: 'Identifiants incorrects.' });
      const token = btoa(JSON.stringify({ id: user.id, email: user.email, role: user.role, nom: user.nom, prenom: user.prenom, exp: Date.now() + 7*24*3600*1000 }));
      return Promise.resolve({ token, user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role } });
    },

    me() {
      const t = localStorage.getItem('fk_token');
      if (!t) return Promise.reject({ status: 401, message: 'Non authentifié.' });
      try {
        const payload = JSON.parse(atob(t));
        const users   = read(KEYS.users);
        const user    = users.find(u => u.id === payload.id);
        if (!user) return Promise.reject({ status: 404, message: 'Utilisateur introuvable.' });
        return Promise.resolve({ user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, tel: user.tel, ile: user.ile, role: user.role } });
      } catch { return Promise.reject({ status: 401, message: 'Token invalide.' }); }
    },

    changePassword(ancien, nouveau) {
      const t = localStorage.getItem('fk_token');
      try {
        const payload = JSON.parse(atob(t));
        const users   = read(KEYS.users);
        const user    = users.find(u => u.id === payload.id);
        if (!user || user.password !== ancien) return Promise.reject({ status: 400, message: 'Ancien mot de passe incorrect.' });
        if (nouveau.length < 8) return Promise.reject({ status: 400, message: 'Mot de passe trop court.' });
        user.password = nouveau;
        write(KEYS.users, users);
        return Promise.resolve({ success: true });
      } catch { return Promise.reject({ status: 401, message: 'Non authentifié.' }); }
    }
  };

  /* ── Projects ────────────────────────────────────────────── */
  const projects = {
    list({ type, page = 1, limit = 12 } = {}) {
      let list = read(KEYS.projects).filter(p => p.status === 'published');
      if (type) list = list.filter(p => p.type === type);
      const total = list.length;
      const off   = (page - 1) * limit;
      return Promise.resolve({ projects: list.slice(off, off + limit), total, page, pages: Math.ceil(total / limit) });
    },

    get(id) {
      const p = read(KEYS.projects).find(p => p.id == id && p.status === 'published');
      if (!p) return Promise.reject({ status: 404, message: 'Projet introuvable.' });
      const contributions = read(KEYS.contributions).filter(c => c.project_id == id).slice(0, 20);
      return Promise.resolve({ project: p, contributions });
    },

    mine() {
      const t = localStorage.getItem('fk_token');
      if (!t) return Promise.reject({ status: 401, message: 'Non authentifié.' });
      try {
        const { id } = JSON.parse(atob(t));
        const list   = read(KEYS.projects).filter(p => p.user_id === id);
        return Promise.resolve({ projects: list });
      } catch { return Promise.reject({ status: 401, message: 'Token invalide.' }); }
    },

    create(data) {
      const t = localStorage.getItem('fk_token');
      if (!t) return Promise.reject({ status: 401, message: 'Non authentifié.' });
      const { id: userId } = JSON.parse(atob(t));
      const project = {
        id: nextId('projects'),
        user_id: userId,
        type:             data.type,
        nom_projet:       data.nom_projet,
        description:      data.description || '',
        secteur:          data.secteur || '',
        montant:          parseInt(data.montant) || 0,
        duree:            parseInt(data.duree) || 30,
        montant_collecte: 0,
        nb_contributeurs: 0,
        status:           'new',
        created_at:       new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      };
      const list = read(KEYS.projects);
      list.push(project);
      write(KEYS.projects, list);

      // Notification admin
      const notifs = read(KEYS.notifications);
      const admins = read(KEYS.users).filter(u => u.role === 'admin');
      admins.forEach(a => {
        notifs.push({ id: nextId('notifs'), user_id: a.id, message: `Nouveau projet : "${project.nom_projet}"`, lien: '/admin.html', lu: 0, created_at: project.created_at });
      });
      write(KEYS.notifications, notifs);

      return Promise.resolve({ success: true, project });
    },

    contribute(id, { montant, methode_paiement = 'mvola', message = '', anonyme = false, nom_contributeur = '' }) {
      const projects = read(KEYS.projects);
      const p        = projects.find(p => p.id == id && p.status === 'published');
      if (!p) return Promise.reject({ status: 404, message: 'Projet introuvable.' });

      const contrib = {
        id: nextId('contribs'),
        project_id: parseInt(id), montant: parseInt(montant),
        methode_paiement, message, anonyme,
        nom_contributeur: anonyme ? 'Anonyme' : (nom_contributeur || 'Contributeur'),
        created_at: new Date().toISOString()
      };
      const contribs = read(KEYS.contributions);
      contribs.push(contrib);
      write(KEYS.contributions, contribs);

      p.montant_collecte = (p.montant_collecte || 0) + parseInt(montant);
      p.nb_contributeurs = (p.nb_contributeurs || 0) + 1;
      p.updated_at = new Date().toISOString();
      write(KEYS.projects, projects);

      // Notification porteur
      if (p.user_id) {
        const notifs = read(KEYS.notifications);
        const qui    = anonyme ? 'Un anonyme' : (nom_contributeur || 'Quelqu\'un');
        notifs.push({ id: nextId('notifs'), user_id: p.user_id, message: `${qui} a contribué ${parseInt(montant).toLocaleString('fr-FR')} KMF à "${p.nom_projet}"`, lien: `/projet-detail.html?id=${id}`, lu: 0, created_at: new Date().toISOString() });
        write(KEYS.notifications, notifs);
      }

      return Promise.resolve({ success: true });
    }
  };

  /* ── User ────────────────────────────────────────────────── */
  const user = {
    profile() {
      const t = localStorage.getItem('fk_token');
      try {
        const { id } = JSON.parse(atob(t));
        const u = read(KEYS.users).find(u => u.id === id);
        if (!u) return Promise.reject({ status: 404, message: 'Introuvable.' });
        return Promise.resolve({ user: { id: u.id, nom: u.nom, prenom: u.prenom, email: u.email, tel: u.tel, ile: u.ile, role: u.role } });
      } catch { return Promise.reject({ status: 401, message: 'Non authentifié.' }); }
    },

    updateProfile(data) {
      const t = localStorage.getItem('fk_token');
      try {
        const { id } = JSON.parse(atob(t));
        const users  = read(KEYS.users);
        const u      = users.find(u => u.id === id);
        if (!u) return Promise.reject({ status: 404, message: 'Introuvable.' });
        Object.assign(u, { nom: data.nom || u.nom, prenom: data.prenom || u.prenom, tel: data.tel ?? u.tel, ile: data.ile ?? u.ile });
        write(KEYS.users, users);
        return Promise.resolve({ user: u });
      } catch { return Promise.reject({ status: 401, message: 'Non authentifié.' }); }
    },

    notifications() {
      const t = localStorage.getItem('fk_token');
      try {
        const { id } = JSON.parse(atob(t));
        const notifs = read(KEYS.notifications).filter(n => n.user_id === id).reverse();
        return Promise.resolve({ notifications: notifs });
      } catch { return Promise.resolve({ notifications: [] }); }
    },

    markNotifRead() {
      const t = localStorage.getItem('fk_token');
      try {
        const { id } = JSON.parse(atob(t));
        const notifs = read(KEYS.notifications).map(n => n.user_id === id ? { ...n, lu: 1 } : n);
        write(KEYS.notifications, notifs);
      } catch {}
      return Promise.resolve({ success: true });
    },

    contributions() {
      const t = localStorage.getItem('fk_token');
      try {
        const { id } = JSON.parse(atob(t));
        const all     = read(KEYS.contributions).filter(c => c.user_id === id);
        const projs   = read(KEYS.projects);
        const result  = all.map(c => ({ ...c, nom_projet: projs.find(p => p.id === c.project_id)?.nom_projet || '—' }));
        return Promise.resolve({ contributions: result });
      } catch { return Promise.resolve({ contributions: [] }); }
    }
  };

  /* ── Admin ───────────────────────────────────────────────── */
  const admin = {
    stats() {
      const ps     = read(KEYS.projects);
      const users  = read(KEYS.users);
      const contribs = read(KEYS.contributions);
      return Promise.resolve({
        totalProjects:     ps.length,
        pendingProjects:   ps.filter(p => ['new','review','interview'].includes(p.status)).length,
        publishedProjects: ps.filter(p => p.status === 'published').length,
        totalUsers:        users.filter(u => u.role === 'user').length,
        totalCollecte:     ps.reduce((a, p) => a + (p.montant_collecte || 0), 0),
        totalContribs:     contribs.length,
        newsletter:        read(KEYS.newsletter).length,
      });
    },

    projects({ status } = {}) {
      let list = read(KEYS.projects);
      if (status) list = list.filter(p => p.status === status);
      return Promise.resolve({ projects: list.reverse(), total: list.length });
    },

    updateStatus(id, status, note = '') {
      const list = read(KEYS.projects);
      const p    = list.find(p => p.id == id);
      if (!p) return Promise.reject({ status: 404, message: 'Projet introuvable.' });
      p.status     = status;
      p.note_admin = note;
      p.updated_at = new Date().toISOString();
      write(KEYS.projects, list);

      if (p.user_id) {
        const msgs = {
          review:    `Votre projet "${p.nom_projet}" est en cours d'examen.`,
          interview: `Nous souhaitons vous contacter pour votre projet "${p.nom_projet}".`,
          approved:  `Votre projet "${p.nom_projet}" a été approuvé !`,
          published: `Votre projet "${p.nom_projet}" est maintenant en ligne !`,
          rejected:  `Votre projet "${p.nom_projet}" n'a pas été retenu. ${note}`,
        };
        if (msgs[status]) {
          const notifs = read(KEYS.notifications);
          notifs.push({ id: nextId('notifs'), user_id: p.user_id, message: msgs[status], lien: '/mon-espace.html', lu: 0, created_at: new Date().toISOString() });
          write(KEYS.notifications, notifs);
        }
      }
      return Promise.resolve({ success: true });
    },

    users() {
      const users = read(KEYS.users).map(u => ({ ...u, password: undefined }));
      return Promise.resolve({ users });
    },

    updateRole(id, role) {
      const users = read(KEYS.users);
      const u = users.find(u => u.id == id);
      if (u) { u.role = role; write(KEYS.users, users); }
      return Promise.resolve({ success: true });
    },

    contributions() {
      const contribs = read(KEYS.contributions);
      const projs    = read(KEYS.projects);
      return Promise.resolve({ contributions: contribs.map(c => ({ ...c, nom_projet: projs.find(p => p.id === c.project_id)?.nom_projet || '—' })).reverse() });
    },

    notifications() {
      const t = localStorage.getItem('fk_token');
      try {
        const { id } = JSON.parse(atob(t));
        return Promise.resolve({ notifications: read(KEYS.notifications).filter(n => n.user_id === id).reverse() });
      } catch { return Promise.resolve({ notifications: [] }); }
    }
  };

  /* ── Newsletter ──────────────────────────────────────────── */
  function newsletter(email) {
    const list = read(KEYS.newsletter);
    if (list.find(e => e.email === email.toLowerCase())) {
      return Promise.resolve({ success: true }); // pas d'erreur en offline
    }
    list.push({ email: email.toLowerCase(), created_at: new Date().toISOString() });
    write(KEYS.newsletter, list);
    return Promise.resolve({ success: true });
  }

  return { auth, projects, user, admin, newsletter };
})();

/* ============================================================
   Patch API : si le backend est inaccessible → bascule sur DB_LOCAL
   ============================================================ */
(function patchAPI() {
  if (typeof API === 'undefined') return;

  const originalRequest = API._request; // non exposé — on wrappe les méthodes

  /* On vérifie la disponibilité du backend une seule fois au chargement */
  let backendOk = null;

  async function checkBackend() {
    if (backendOk !== null) return backendOk;
    try {
      const r = await fetch('http://localhost:3001/api/health', { signal: AbortSignal.timeout(1500) });
      backendOk = r.ok;
    } catch {
      backendOk = false;
    }
    if (!backendOk) {
      console.info('[FaidaKomori] Backend non détecté → mode offline (localStorage)');
      showOfflineBanner();
    }
    return backendOk;
  }

  function showOfflineBanner() {
    if (document.getElementById('fk-offline-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'fk-offline-banner';
    banner.style.cssText = 'position:fixed;bottom:1rem;left:50%;transform:translateX(-50%);background:#1A3A6B;color:#fff;padding:0.6rem 1.2rem;border-radius:50px;font-size:0.8rem;font-weight:600;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.3);display:flex;align-items:center;gap:0.6rem;';
    banner.innerHTML = '⚡ Mode démo — données locales · <a href="DEMARRAGE.md" style="color:var(--gold,#E8A020);text-decoration:underline;">Activer le backend</a>';
    document.body.appendChild(banner);
    setTimeout(() => { banner.style.opacity = '0'; banner.style.transition = 'opacity 1s'; setTimeout(() => banner.remove(), 1000); }, 6000);
  }

  /* Wrap toutes les méthodes API pour fallback local */
  function wrapMethod(apiObj, localObj, key) {
    if (typeof localObj[key] !== 'function') return;
    const original = apiObj[key].bind(apiObj);
    apiObj[key] = async (...args) => {
      const ok = await checkBackend();
      if (!ok) return localObj[key](...args);
      try {
        return await original(...args);
      } catch (err) {
        if (err.status === 0) return localObj[key](...args);
        throw err;
      }
    };
  }

  checkBackend().then(() => {
    ['login','register','me','changePassword'].forEach(k => wrapMethod(API.auth, DB_LOCAL.auth, k));
    ['list','get','mine','create','contribute'].forEach(k => wrapMethod(API.projects, DB_LOCAL.projects, k));
    ['profile','updateProfile','notifications','markNotifRead','contributions'].forEach(k => wrapMethod(API.user, DB_LOCAL.user, k));
    ['stats','projects','updateStatus','users','updateRole','contributions','notifications'].forEach(k => wrapMethod(API.admin, DB_LOCAL.admin, k));
    const origNL = API.newsletter.bind(API);
    API.newsletter = async (email) => {
      const ok = await checkBackend();
      return ok ? origNL(email).catch(e => e.status === 0 ? DB_LOCAL.newsletter(email) : Promise.reject(e)) : DB_LOCAL.newsletter(email);
    };
  });
})();
