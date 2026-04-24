/* ============================================================
   FaidaKomori — api.js
   Couche API client réutilisable sur toutes les pages
   BASE_URL pointe vers le backend Express (port 3001)
   ============================================================ */

const API = (() => {
  // URL de l'API : relative en production (Render), absolue en local
  const BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001/api'
    : '/api';

  function getToken() {
    return localStorage.getItem('fk_token');
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem('fk_user')); } catch { return null; }
  }

  function setSession(token, user) {
    localStorage.setItem('fk_token', token);
    localStorage.setItem('fk_user', JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem('fk_token');
    localStorage.removeItem('fk_user');
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function isAdmin() {
    const u = getUser();
    return u && u.role === 'admin';
  }

  async function request(method, endpoint, body = null, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && getToken()) headers['Authorization'] = `Bearer ${getToken()}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    try {
      const res  = await fetch(`${BASE}${endpoint}`, opts);
      const data = await res.json();
      if (!res.ok) throw { status: res.status, message: data.error || 'Erreur serveur' };
      return data;
    } catch (err) {
      if (err.status) throw err;
      throw { status: 0, message: 'Impossible de joindre le serveur. Vérifiez que le backend est démarré.' };
    }
  }

  return {
    getToken, getUser, setSession, clearSession, isLoggedIn, isAdmin,

    // Auth
    auth: {
      login:    (email, password) => request('POST', '/auth/login', { email, password }, false),
      register: (data)           => request('POST', '/auth/register', data, false),
      me:       ()               => request('GET',  '/auth/me'),
      changePassword: (ancien, nouveau) => request('POST', '/auth/change-password', { ancien, nouveau }),
      forgotPassword: (email)           => request('POST', '/auth/forgot-password', { email }, false),
      resetPassword:  (token, password) => request('POST', '/auth/reset-password', { token, password }, false),
    },

    // Projects (public)
    projects: {
      list:        (params = {})   => {
        const qs = new URLSearchParams(params).toString();
        return request('GET', `/projects${qs ? '?' + qs : ''}`, null, false);
      },
      get:         (id)            => request('GET', `/projects/${id}`, null, false),
      mine:        ()              => request('GET', '/projects/mine'),
      create:      (data)          => request('POST', '/projects', data),
      contribute:  (id, data)      => request('POST', `/projects/${id}/contribute`, data, false),
    },

    // User
    user: {
      profile:           ()       => request('GET',   '/user/profile'),
      updateProfile:     (data)   => request('PATCH', '/user/profile', data),
      notifications:     ()       => request('GET',   '/user/notifications'),
      markNotifRead:     ()       => request('POST',  '/user/notifications/read'),
      contributions:     ()       => request('GET',   '/user/contributions'),
      getPaiement:       ()       => request('GET',   '/user/paiement'),
      updatePaiement:    (data)   => request('PATCH', '/user/paiement', data),
    },

    // Dépôt combiné (compte + projet en une seule requête)
    deposer: (data) => request('POST', '/deposer', data, false),

    // Contributions — gestion livraison
    contributions: {
      porteurList:       (projectId)               => request('GET',   `/projects/${projectId}/contributions-porteur`),
      marquerLivraison:  (projectId, contribId, st) => request('PATCH', `/projects/${projectId}/contributions/${contribId}/livraison`, { status: st }),
      marquerRecu:       (contribId)               => request('PATCH', `/user/contributions/${contribId}/recu`, {}),
    },

    // Admin
    admin: {
      stats:             ()                    => request('GET',   '/admin/stats'),
      projects:          (params = {})         => {
        const qs = new URLSearchParams(params).toString();
        return request('GET', `/admin/projects${qs ? '?' + qs : ''}`);
      },
      updateStatus:      (id, status, note)    => request('PATCH', `/admin/projects/${id}/status`, { status, note_admin: note }),
      getProject:        (id)                  => request('GET',   `/admin/projects/${id}`),
      scheduleInterview: (id, data)            => request('POST',  `/admin/projects/${id}/interview`, data),
      users:             ()                    => request('GET',   '/admin/users'),
      updateRole:        (id, role)            => request('PATCH', `/admin/users/${id}/role`, { role }),
      contributions:     ()                    => request('GET',   '/admin/contributions'),
      notifications:     ()                    => request('GET',   '/admin/notifications'),
      versements:        ()                    => request('GET',   '/admin/versements'),
      processVersement:  (id, data)            => request('PATCH', `/admin/versements/${id}`, data),
      topDonors:         ()                    => request('GET',   '/admin/top-donors'),
    },

    // Versements porteur
    versements: {
      demander:  (projectId, data) => request('POST', `/projects/${projectId}/demande-versement`, data),
      historique:(projectId)       => request('GET',  `/projects/${projectId}/versements`),
    },

    // Newsletter
    newsletter: (email) => request('POST', '/newsletter', { email }, false),

    // Entretien
    acceptInterview: (projectId, accepted) => request('POST', `/projects/${projectId}/accept-interview`, { accepted }),
  };
})();

/* ── Auth guard : redirige si non connecté ──────────────────── */
function requireLogin(redirectTo = 'login.html') {
  if (!API.isLoggedIn()) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

/* ── Auth guard admin ───────────────────────────────────────── */
function requireAdminAccess() {
  if (!API.isLoggedIn()) {
    window.location.href = 'login.html?redirect=admin';
    return false;
  }
  if (!API.isAdmin()) {
    window.location.href = 'mon-espace.html';
    return false;
  }
  return true;
}

/* ══════════════════════════════════════════════════════════════
   initNavbarAuth — VERSION UNIQUE & DÉFINITIVE
   Injecte le bon élément selon l'état de connexion :
   • Visiteur     → bouton "Se connecter"
   • Connecté     → pill avatar + dropdown (Mon espace, Admin, Logout)
   Appeler après DOMContentLoaded sur chaque page.
══════════════════════════════════════════════════════════════ */
function initNavbarAuth() {
  const user     = API.getUser();
  const isLogged = API.isLoggedIn();

  /* ── DESKTOP ──────────────────────────────────────────────── */
  const navLinks = document.querySelector('.navbar__links');
  if (navLinks) {
    // Supprimer tout élément auth précédent (idempotent)
    navLinks.querySelector('.nav-auth-item')?.remove();

    const li = document.createElement('li');
    li.className = 'nav-auth-item';

    if (isLogged && user) {
      /* ── Utilisateur connecté : dropdown avec avatar ───── */
      const initial = (user.prenom?.[0] || user.nom?.[0] || '?').toUpperCase();
      li.innerHTML = `
        <div class="navbar__user" id="navbar-user-menu">
          <div class="navbar__user-avatar" id="navbar-avatar-badge">${initial}</div>
          <span class="navbar__user-label">${user.prenom}</span>
          <span class="navbar__user-caret">▾</span>
          <div class="navbar__user-menu">
            <a href="mon-espace.html"><i class="ph-light ph-user-circle"></i> Mon espace</a>
            <a href="deposer.html"><i class="ph-light ph-plus-circle"></i> Déposer un projet</a>
            ${user.role === 'admin' ? '<a href="admin.html"><i class="ph-light ph-gear"></i> Administration</a>' : ''}
            <hr/>
            <button id="navbar-logout"><i class="ph-light ph-sign-out"></i> Se déconnecter</button>
          </div>
        </div>`;
      navLinks.appendChild(li);

      document.getElementById('navbar-logout')?.addEventListener('click', () => {
        API.clearSession();
        window.location.href = 'index.html';
      });

      // Badge notifications non-lues
      API.user.notifications().then(({ notifications }) => {
        const unread = (notifications || []).filter(n => !n.lu).length;
        if (unread > 0) {
          const wrap = document.getElementById('navbar-avatar-badge');
          if (wrap) {
            wrap.style.position = 'relative';
            // Petit cercle rouge positionné en absolu via inline style
            wrap.insertAdjacentHTML('afterend',
              `<span class="navbar__notif-badge">${unread > 9 ? '9+' : unread}</span>`
            );
          }
        }
      }).catch(() => {});

    } else {
      /* ── Visiteur non connecté : bouton Se connecter ───── */
      li.innerHTML = `
        <a href="login.html" class="btn btn-outline btn-sm nav-login-btn">
          <i class="ph-light ph-sign-in"></i> Se connecter
        </a>`;
      navLinks.appendChild(li);
    }
  }

  /* ── MOBILE ───────────────────────────────────────────────── */
  const mobileMenu = document.querySelector('.navbar__mobile');
  if (mobileMenu) {
    // Nettoyer les éléments auth précédents
    mobileMenu.querySelectorAll('.mobile-auth-item, .mobile-logout-btn').forEach(el => el.remove());

    if (isLogged && user) {
      /* ── Connecté : liens espace + déconnexion ─────────── */
      const mobileDeposer = mobileMenu.querySelector('a[href="deposer.html"]');
      const linksHtml = `
        <a class="mobile-auth-item" href="mon-espace.html"
           style="color:var(--green);font-weight:600;display:flex;align-items:center;gap:0.5rem;">
          <i class="ph-light ph-user-circle"></i> Mon espace (${user.prenom})
        </a>
        ${user.role === 'admin'
          ? `<a class="mobile-auth-item" href="admin.html"
               style="color:var(--gold);font-weight:600;display:flex;align-items:center;gap:0.5rem;background:rgba(232,160,32,0.1);padding:0.5rem 0.75rem;border-radius:8px;margin-top:0.25rem;">
               <i class="ph-light ph-shield-star"></i> Administration
             </a>`
          : ''}`;
      if (mobileDeposer) {
        mobileDeposer.insertAdjacentHTML('afterend', linksHtml);
      } else {
        mobileMenu.insertAdjacentHTML('beforeend', linksHtml);
      }
      mobileMenu.insertAdjacentHTML('beforeend', `
        <button class="mobile-logout-btn btn btn-outline"
                style="margin-top:0.5rem;width:100%;display:flex;align-items:center;justify-content:center;gap:0.5rem;">
          <i class="ph-light ph-sign-out"></i> Se déconnecter
        </button>`);
      mobileMenu.querySelector('.mobile-logout-btn')?.addEventListener('click', () => {
        API.clearSession();
        window.location.href = 'index.html';
      });

    } else {
      /* ── Visiteur : lien Se connecter en bas du menu ───── */
      const el = document.createElement('a');
      el.className = 'mobile-auth-item';
      el.href = 'login.html';
      el.innerHTML = `<i class="ph-light ph-sign-in"></i> Se connecter`;
      el.style.cssText = `
        color: var(--navy);
        font-weight: 600;
        border-top: 1px solid var(--border-solid);
        padding-top: 1rem;
        margin-top: 0.25rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      `;
      mobileMenu.appendChild(el);
    }
  }

  /* ── BOUTON INLINE dans la barre navbar (visible sans ouvrir le menu) ── */
  const navInner   = document.querySelector('.navbar__inner');
  const hamburger  = document.querySelector('.navbar__hamburger');
  if (navInner && hamburger) {
    document.getElementById('navbar-mobile-inline')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'navbar-mobile-inline';

    if (isLogged && user) {
      /* Avatar cliquable → ouvre le menu hamburger */
      const initial = (user.prenom?.[0] || user.nom?.[0] || '?').toUpperCase();
      wrap.innerHTML = `<div class="nmb-avatar">${initial}</div>`;
      wrap.querySelector('.nmb-avatar').addEventListener('click', () => hamburger.click());
    } else {
      /* Bouton Connexion compact */
      wrap.innerHTML = `<a href="login.html" class="nmb-login">
        <i class="ph-light ph-sign-in"></i> Connexion
      </a>`;
    }
    navInner.insertBefore(wrap, hamburger);
  }

  /* ── Click toggle pour dropdown desktop (touch devices) ── */
  const navbarUser = document.getElementById('navbar-user-menu');
  if (navbarUser) {
    navbarUser.addEventListener('click', (e) => {
      navbarUser.classList.toggle('open');
      e.stopPropagation();
    });
    document.addEventListener('click', () => navbarUser.classList.remove('open'));
  }
}

window.API                = API;
window.requireLogin       = requireLogin;
window.requireAdminAccess = requireAdminAccess;
window.initNavbarAuth     = initNavbarAuth;
