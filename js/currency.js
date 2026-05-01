/* ============================================================
   FaidaKomori — currency.js
   Sélecteur de devise : KMF · EUR · USD · CAD
   Stocké dans localStorage('fk_currency')
   Convertit tous les éléments [data-kmf] sur la page
   ============================================================ */

/* ── Drapeaux SVG inline ─────────────────────────────────────
   SVG embarqués directement : aucun chemin de fichier,
   fonctionne sur tous les appareils et toutes les pages.
   ──────────────────────────────────────────────────────────── */
const _FS = 'border-radius:2px;vertical-align:middle;box-shadow:0 0 0 1px rgba(0,0,0,0.14);flex-shrink:0;display:inline-block;';

const FK_FLAGS = {

  /* 🇰🇲  Comores
     4 bandes : jaune / blanc / rouge / bleu
     Triangle vert à gauche
     Croissant blanc (ouverture → droite) :
       grand cercle blanc (cx=4,r=2.6) masqué par cercle vert (cx=5.2,r=2.1)
     4 étoiles blanches DANS la concavité du croissant  */
  KMF: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16" width="22" height="15" style="${_FS}" aria-label="Comores"><rect width="24" height="4" fill="#FCD116"/><rect y="4" width="24" height="4" fill="#FFF"/><rect y="8" width="24" height="4" fill="#CE1126"/><rect y="12" width="24" height="4" fill="#3A75C4"/><polygon points="0,0 9,8 0,16" fill="#009A44"/><circle cx="4" cy="8" r="2.6" fill="#FFF"/><circle cx="5.2" cy="8" r="2.1" fill="#009A44"/><circle cx="5.7" cy="6.2" r="0.52" fill="#FFF"/><circle cx="5.7" cy="7.4" r="0.52" fill="#FFF"/><circle cx="5.7" cy="8.6" r="0.52" fill="#FFF"/><circle cx="5.7" cy="9.8" r="0.52" fill="#FFF"/></svg>`,

  /* 🇪🇺  Union européenne
     Fond bleu — 12 étoiles dorées en cercle (r=4.5, centré 12,8) */
  EUR: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16" width="22" height="15" style="${_FS}" aria-label="Union européenne"><rect width="24" height="16" fill="#003399"/><circle cx="12"    cy="3.5"  r="0.88" fill="#FFCC00"/><circle cx="14.25" cy="4.1"  r="0.88" fill="#FFCC00"/><circle cx="15.9"  cy="5.75" r="0.88" fill="#FFCC00"/><circle cx="16.5"  cy="8"    r="0.88" fill="#FFCC00"/><circle cx="15.9"  cy="10.25" r="0.88" fill="#FFCC00"/><circle cx="14.25" cy="11.9" r="0.88" fill="#FFCC00"/><circle cx="12"    cy="12.5" r="0.88" fill="#FFCC00"/><circle cx="9.75"  cy="11.9" r="0.88" fill="#FFCC00"/><circle cx="8.1"   cy="10.25" r="0.88" fill="#FFCC00"/><circle cx="7.5"   cy="8"    r="0.88" fill="#FFCC00"/><circle cx="8.1"   cy="5.75" r="0.88" fill="#FFCC00"/><circle cx="9.75"  cy="4.1"  r="0.88" fill="#FFCC00"/></svg>`,

  /* 🇺🇸  États-Unis
     7 bandes rouges sur fond blanc — canton bleu + étoiles blanches */
  USD: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16" width="22" height="15" style="${_FS}" aria-label="États-Unis"><rect width="24" height="16" fill="#FFF"/><rect width="24" height="1.23" fill="#B22234"/><rect y="2.46"  width="24" height="1.23" fill="#B22234"/><rect y="4.92"  width="24" height="1.23" fill="#B22234"/><rect y="7.38"  width="24" height="1.23" fill="#B22234"/><rect y="9.85"  width="24" height="1.23" fill="#B22234"/><rect y="12.31" width="24" height="1.23" fill="#B22234"/><rect y="14.77" width="24" height="1.23" fill="#B22234"/><rect width="10" height="8.62" fill="#3C3B6E"/><circle cx="1.4" cy="0.95" r="0.42" fill="#FFF"/><circle cx="3.3" cy="0.95" r="0.42" fill="#FFF"/><circle cx="5.1" cy="0.95" r="0.42" fill="#FFF"/><circle cx="6.9" cy="0.95" r="0.42" fill="#FFF"/><circle cx="8.7" cy="0.95" r="0.42" fill="#FFF"/><circle cx="2.3" cy="2.46" r="0.42" fill="#FFF"/><circle cx="4.2" cy="2.46" r="0.42" fill="#FFF"/><circle cx="6.0" cy="2.46" r="0.42" fill="#FFF"/><circle cx="7.8" cy="2.46" r="0.42" fill="#FFF"/><circle cx="1.4" cy="3.97" r="0.42" fill="#FFF"/><circle cx="3.3" cy="3.97" r="0.42" fill="#FFF"/><circle cx="5.1" cy="3.97" r="0.42" fill="#FFF"/><circle cx="6.9" cy="3.97" r="0.42" fill="#FFF"/><circle cx="8.7" cy="3.97" r="0.42" fill="#FFF"/><circle cx="2.3" cy="5.48" r="0.42" fill="#FFF"/><circle cx="4.2" cy="5.48" r="0.42" fill="#FFF"/><circle cx="6.0" cy="5.48" r="0.42" fill="#FFF"/><circle cx="7.8" cy="5.48" r="0.42" fill="#FFF"/><circle cx="1.4" cy="6.99" r="0.42" fill="#FFF"/><circle cx="3.3" cy="6.99" r="0.42" fill="#FFF"/><circle cx="5.1" cy="6.99" r="0.42" fill="#FFF"/><circle cx="6.9" cy="6.99" r="0.42" fill="#FFF"/><circle cx="8.7" cy="6.99" r="0.42" fill="#FFF"/></svg>`,

  /* 🇨🇦  Canada
     Deux bandes rouges + blanc central + feuille d'érable rouge */
  CAD: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16" width="22" height="15" style="${_FS}" aria-label="Canada"><rect width="6"  height="16" fill="#FF0000"/><rect x="18" width="6" height="16" fill="#FF0000"/><rect x="6"  width="12" height="16" fill="#FFF"/><path d="M12,3.2 L12.9,5.8 L15.2,4.8 L14.0,7.2 L16.2,7.6 L12,12.5 L7.8,7.6 L10.0,7.2 L8.8,4.8 L11.1,5.8 Z" fill="#FF0000"/><rect x="11.35" y="12.4" width="1.3" height="1.8" fill="#FF0000"/></svg>`,
};

const FK_CURR = {
  KMF: { symbol: 'KMF', rate: 1,          label: 'KMF — Franc comorien',    flag: FK_FLAGS.KMF },
  EUR: { symbol: '€',   rate: 1 / 492,    label: 'EUR — Euro',               flag: FK_FLAGS.EUR },
  USD: { symbol: '$',   rate: 1 / 450,    label: 'USD — Dollar américain',   flag: FK_FLAGS.USD },
  CAD: { symbol: 'CA$', rate: 1 / 331,    label: 'CAD — Dollar canadien',    flag: FK_FLAGS.CAD },
};

/* ── Lecture / écriture préférence ────────────────────────── */
function fkGetCurrency() {
  return localStorage.getItem('fk_currency') || 'KMF';
}
function fkSetCurrency(code) {
  if (!FK_CURR[code]) return;
  localStorage.setItem('fk_currency', code);
  fkApplyAll();
}

/* ── Formater un montant KMF → devise choisie ─────────────── */
function fkFormat(kmf, currency) {
  currency = currency || fkGetCurrency();
  const cfg = FK_CURR[currency] || FK_CURR.KMF;
  const val = Math.round(kmf * cfg.rate);
  if (currency === 'KMF') {
    return `${val.toLocaleString('fr-FR')} KMF`;
  }
  return `${cfg.symbol} ${val.toLocaleString('fr-FR')}`;
}

/* ── Mettre à jour tous les éléments [data-kmf] ──────────── */
function fkApplyAll() {
  const currency = fkGetCurrency();
  document.querySelectorAll('[data-kmf]').forEach(el => {
    const kmf = parseFloat(el.dataset.kmf);
    if (!isNaN(kmf)) el.textContent = fkFormat(kmf, currency);
  });
  /* Mettre à jour le label du bouton desktop */
  const btn = document.getElementById('fk-curr-btn');
  if (btn) btn.innerHTML = `${FK_CURR[currency].flag}<span style="font-weight:700;margin-left:0.3rem;">${currency}</span><span class="fk-caret" style="font-size:0.55rem;opacity:0.65;margin-left:0.15rem;">▾</span>`;
  /* Mettre à jour les options actives */
  document.querySelectorAll('.fk-curr-opt').forEach(opt => {
    const active = opt.dataset.currency === currency;
    opt.style.background = active ? 'var(--navy)' : '';
    opt.style.color      = active ? '#fff'        : 'var(--navy)';
    opt.style.fontWeight = active ? '700'         : '600';
  });
}

/* ── Bouton desktop dans la navbar ───────────────────────── */
function fkInitDesktopBtn() {
  const navLinks = document.querySelector('.navbar__links');
  if (!navLinks || document.getElementById('fk-curr-wrap')) return;

  const currency = fkGetCurrency();
  const li = document.createElement('li');
  li.id = 'fk-curr-wrap';
  li.style.cssText = 'position:relative;display:flex;align-items:center;';
  li.innerHTML = `
    <button id="fk-curr-btn"
      style="display:flex;align-items:center;gap:0.35rem;padding:0.28rem 0.6rem;
             border:1.5px solid var(--border-solid);border-radius:20px;
             background:#fff;color:var(--navy);font-size:0.8rem;font-weight:700;
             cursor:pointer;transition:all 0.18s;white-space:nowrap;"
      aria-label="Changer la devise">
      ${FK_CURR[currency].flag}<span style="font-weight:700;margin-left:0.3rem;">${currency}</span><span class="fk-caret" style="font-size:0.55rem;opacity:0.65;margin-left:0.15rem;">▾</span>
    </button>
    <div id="fk-curr-dd"
      style="display:none;position:absolute;right:0;top:calc(100% + 8px);
             background:#fff;border:1px solid var(--border-solid);
             border-radius:var(--radius-sm);box-shadow:0 8px 24px rgba(0,0,0,0.12);
             min-width:215px;z-index:999;overflow:hidden;">
      ${Object.entries(FK_CURR).map(([code, cfg]) => `
        <button class="fk-curr-opt" data-currency="${code}"
          style="display:flex;align-items:center;gap:0.65rem;width:100%;padding:0.65rem 1rem;
                 font-size:0.84rem;font-weight:600;background:none;border:none;
                 cursor:pointer;color:var(--navy);transition:background 0.15s;text-align:left;">
          ${cfg.flag}
          <span>${cfg.label}</span>
        </button>`).join('')}
    </div>`;

  /* Insérer avant l'item auth */
  const authItem = navLinks.querySelector('.nav-auth-item');
  if (authItem) navLinks.insertBefore(li, authItem);
  else navLinks.appendChild(li);

  /* Toggle dropdown */
  const btn = document.getElementById('fk-curr-btn');
  const dd  = document.getElementById('fk-curr-dd');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = dd.style.display !== 'none';
    dd.style.display = open ? 'none' : 'block';
    btn.style.borderColor = open ? 'var(--border-solid)' : 'var(--navy)';
  });

  /* Sélection */
  li.querySelectorAll('.fk-curr-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      fkSetCurrency(opt.dataset.currency);
      dd.style.display = 'none';
      btn.style.borderColor = 'var(--border-solid)';
    });
  });

  /* Fermer au clic extérieur */
  document.addEventListener('click', () => {
    if (dd) { dd.style.display = 'none'; btn.style.borderColor = 'var(--border-solid)'; }
  });

  fkApplyAll();
}

/* ── Bouton mobile dans le menu hamburger ─────────────────── */
function fkInitMobileBtn() {
  const mobileMenu = document.querySelector('.navbar__mobile');
  if (!mobileMenu || document.getElementById('fk-curr-mobile')) return;

  const currency = fkGetCurrency();
  const div = document.createElement('div');
  div.id = 'fk-curr-mobile';
  div.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem;padding:0.65rem 0;border-top:1px solid var(--border-solid);margin-top:0.5rem;';
  div.innerHTML = `
    <span style="font-size:0.74rem;color:var(--text-muted);font-weight:600;width:100%;display:block;margin-bottom:0.15rem;">
      Devise
    </span>` +
    Object.entries(FK_CURR).map(([code, cfg]) =>
      `<button class="fk-curr-opt" data-currency="${code}"
         style="display:inline-flex;align-items:center;gap:0.35rem;
                padding:0.28rem 0.65rem;border-radius:20px;font-size:0.78rem;font-weight:700;
                cursor:pointer;border:1.5px solid var(--border-solid);
                background:${code === currency ? 'var(--navy)' : '#fff'};
                color:${code === currency ? '#fff' : 'var(--navy)'};">
         ${cfg.flag}<span style="margin-left:0.2rem;">${code}</span>
       </button>`
    ).join('');
  mobileMenu.appendChild(div);

  div.querySelectorAll('.fk-curr-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      fkSetCurrency(opt.dataset.currency);
      div.querySelectorAll('.fk-curr-opt').forEach(o => {
        const active = o.dataset.currency === opt.dataset.currency;
        o.style.background = active ? 'var(--navy)' : '#fff';
        o.style.color      = active ? '#fff'        : 'var(--navy)';
      });
    });
  });
}

/* ── Point d'entrée principal ────────────────────────────── */
function fkInitCurrency() {
  fkInitDesktopBtn();
  fkInitMobileBtn();
  fkApplyAll();
}

/* ── Auto-init ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', fkInitCurrency);

/* ── Exposer globalement ─────────────────────────────────── */
window.fkFormat      = fkFormat;
window.fkGetCurrency = fkGetCurrency;
window.fkSetCurrency = fkSetCurrency;
window.fkApplyAll    = fkApplyAll;
window.FK_CURR       = FK_CURR;
