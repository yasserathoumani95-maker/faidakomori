/* ============================================================
   FaidaKomori — currency.js
   Sélecteur de devise : KMF · EUR · USD · CAD
   Stocké dans localStorage('fk_currency')
   Convertit tous les éléments [data-kmf] sur la page
   ============================================================ */

/* ── Drapeaux SVG inline (fonctionnent depuis toutes les pages) ── */
const FK_FLAGS = {
  KMF: `<img src="img/flags/km.svg" width="22" height="15" alt="Comores"
              style="border-radius:2px;vertical-align:middle;box-shadow:0 0 0 1px rgba(0,0,0,0.12);flex-shrink:0;">`,
  EUR: `<img src="img/flags/eu.svg" width="22" height="15" alt="EU"
              style="border-radius:2px;vertical-align:middle;box-shadow:0 0 0 1px rgba(0,0,0,0.12);flex-shrink:0;">`,
  USD: `<img src="img/flags/us.svg" width="22" height="15" alt="USA"
              style="border-radius:2px;vertical-align:middle;box-shadow:0 0 0 1px rgba(0,0,0,0.12);flex-shrink:0;">`,
  CAD: `<img src="img/flags/ca.svg" width="22" height="15" alt="Canada"
              style="border-radius:2px;vertical-align:middle;box-shadow:0 0 0 1px rgba(0,0,0,0.12);flex-shrink:0;">`,
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
  return `${cfg.symbol} ${val.toLocaleString('fr-FR')}`;
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
  if (btn) btn.innerHTML = `${FK_CURR[currency].flag} <span style="font-weight:700;">${currency}</span> <span class="fk-caret" style="font-size:0.58rem;opacity:0.7;">▾</span>`;
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
      style="display:flex;align-items:center;gap:0.4rem;padding:0.3rem 0.65rem;
             border:1.5px solid var(--border-solid);border-radius:20px;
             background:#fff;color:var(--navy);font-size:0.8rem;font-weight:700;
             cursor:pointer;transition:all 0.18s;white-space:nowrap;"
      aria-label="Changer la devise">
      ${FK_CURR[currency].flag} <span style="font-weight:700;">${currency}</span> <span class="fk-caret" style="font-size:0.58rem;opacity:0.7;">▾</span>
    </button>
    <div id="fk-curr-dd"
      style="display:none;position:absolute;right:0;top:calc(100% + 8px);
             background:#fff;border:1px solid var(--border-solid);
             border-radius:var(--radius-sm);box-shadow:0 8px 24px rgba(0,0,0,0.12);
             min-width:210px;z-index:999;overflow:hidden;">
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
  div.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4rem;padding:0.65rem 0;border-top:1px solid var(--border-solid);margin-top:0.5rem;';
  div.innerHTML = `
    <span style="font-size:0.74rem;color:var(--text-muted);font-weight:600;width:100%;display:block;margin-bottom:0.2rem;">
      <i class="ph-light ph-currency-circle-dollar"></i> Devise
    </span>` +
    Object.entries(FK_CURR).map(([code, cfg]) =>
      `<button class="fk-curr-opt" data-currency="${code}"
         style="display:inline-flex;align-items:center;gap:0.35rem;
                padding:0.28rem 0.65rem;border-radius:20px;font-size:0.78rem;font-weight:700;
                cursor:pointer;border:1.5px solid var(--border-solid);
                background:${code === currency ? 'var(--navy)' : '#fff'};
                color:${code === currency ? '#fff' : 'var(--navy)'};">
         ${cfg.flag} ${code}
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
