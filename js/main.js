/* ============================================================
   FaidaKomori — main.js
   Skills : full-output-enforcement · design-taste-frontend
            high-end-visual-design · redesign-existing-projects
   Vanilla JS — aucune dépendance externe
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── 0. Auth navbar — bouton connexion / Mon Espace ─────── */
  if (typeof initNavbarAuth === 'function') initNavbarAuth();

  /* ── 1. Navbar scroll ───────────────────────────────────── */
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── 2. Hamburger ───────────────────────────────────────── */
  const hamburger  = document.querySelector('.navbar__hamburger');
  const mobileMenu = document.querySelector('.navbar__mobile');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const open = hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', String(open));
    });
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
      });
    });
    document.addEventListener('click', e => {
      if (navbar && !navbar.contains(e.target)) {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
      }
    });
  }

  /* ── 3. Scroll reveal (staggered — IntersectionObserver) ── */
  // Applique .reveal à tous les éléments ciblés
  const REVEAL_SELECTORS = [
    '.model-card', '.why-card', '.step',
    '.project-card', '.faq-item',
    '[data-reveal]'
  ];
  const revealEls = document.querySelectorAll(REVEAL_SELECTORS.join(','));
  revealEls.forEach(el => el.classList.add('reveal'));

  // Observer avec stagger automatique dans les grilles
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el     = entry.target;
      const parent = el.parentElement;
      const siblings = parent
        ? Array.from(parent.querySelectorAll('.reveal'))
        : [el];
      const idx = siblings.indexOf(el);
      el.style.transitionDelay = `${Math.min(idx * 0.07, 0.42)}s`;
      el.classList.add('visible');
      revealIO.unobserve(el);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach(el => revealIO.observe(el));

  /* ── 4. Barres de progression animées ──────────────────── */
  const progressBars = document.querySelectorAll('.progress-bar__fill[data-pct]');
  if (progressBars.length) {
    const barIO = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        // Court délai pour que la transition soit visible
        requestAnimationFrame(() => {
          el.style.width = el.dataset.pct + '%';
        });
        barIO.unobserve(el);
      });
    }, { threshold: 0.4 });
    progressBars.forEach(bar => barIO.observe(bar));
  }

  /* ── 5. Compteurs animés ───────────────────────────────── */
  function animateCounter(el) {
    const target   = parseFloat(el.dataset.target);
    const suffix   = el.dataset.suffix  || '';
    const prefix   = el.dataset.prefix  || '';
    const decimals = el.dataset.decimal ? parseInt(el.dataset.decimal) : 0;
    const duration = 1600;
    const start    = performance.now();
    const update   = now => {
      const p  = Math.min((now - start) / duration, 1);
      // Ease out cubic
      const ep = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + (target * ep).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  const counterEls = document.querySelectorAll('[data-counter]');
  if (counterEls.length) {
    const counterIO = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        counterIO.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counterEls.forEach(el => counterIO.observe(el));
  }

  /* ── 6. Smooth scroll ──────────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const id = link.getAttribute('href');
      if (id === '#') return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  /* ── 7. FAQ accordéon ──────────────────────────────────── */
  document.querySelectorAll('.faq-item__question').forEach(btn => {
    btn.addEventListener('click', () => {
      const answer = btn.nextElementSibling;
      const isOpen = btn.classList.contains('open');
      // Fermer tous
      document.querySelectorAll('.faq-item__question.open').forEach(q => {
        q.classList.remove('open');
        q.nextElementSibling.classList.remove('open');
      });
      if (!isOpen) {
        btn.classList.add('open');
        answer.classList.add('open');
      }
    });
  });

  /* ── 8. Filtres projets ────────────────────────────────── */
  const filterBtns  = document.querySelectorAll('.filter-btn[data-filter]');
  const projectCards = document.querySelectorAll('.project-card[data-type]');

  if (filterBtns.length) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        filterBtns.forEach(b => b.classList.remove('active', 'active-gold', 'active-ocean'));

        if (filter === 'prevente')      btn.classList.add('active-gold');
        else if (filter === 'dons')     btn.classList.add('active-ocean');
        else                            btn.classList.add('active');

        projectCards.forEach((card, i) => {
          const show = filter === 'all' || card.dataset.type === filter;
          card.style.display = show ? '' : 'none';
          if (show) {
            card.style.opacity = '0';
            card.style.transform = 'translateY(16px)';
            setTimeout(() => {
              card.style.transition = 'opacity 0.5s cubic-bezier(0.16,1,0.3,1), transform 0.5s cubic-bezier(0.16,1,0.3,1)';
              card.style.transitionDelay = `${i * 0.06}s`;
              card.style.opacity = '1';
              card.style.transform = 'translateY(0)';
            }, 10);
          }
        });
      });
    });
  }

  /* ── 9. Stepper formulaire ─────────────────────────────── */
  const steps        = document.querySelectorAll('.form-step');
  const stepperItems = document.querySelectorAll('.stepper__step');
  const stepperLines = document.querySelectorAll('.stepper__line');
  let currentStep    = 0;

  function goToStep(n) {
    if (n < 0 || n >= steps.length) return;
    steps.forEach((s, i)       => s.classList.toggle('active', i === n));
    stepperItems.forEach((si, i) => {
      si.classList.remove('active', 'done');
      if (i < n) si.classList.add('done');
      if (i === n) si.classList.add('active');
    });
    stepperLines.forEach((line, i) => {
      line.style.background = i < n ? 'var(--ocean)' : 'var(--border-solid)';
    });
    currentStep = n;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateRecap();
  }

  document.querySelectorAll('[data-next]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (validateCurrentStep()) goToStep(currentStep + 1);
    });
  });
  document.querySelectorAll('[data-prev]').forEach(btn => {
    btn.addEventListener('click', () => goToStep(currentStep - 1));
  });

  /* ── 10. Sélection type de projet ──────────────────────── */
  const typeCards         = document.querySelectorAll('.type-card[data-type]');
  const typeInput         = document.getElementById('selected-type');
  const conditionalFields = document.querySelectorAll('.conditional-field');

  function selectType(type) {
    typeCards.forEach(c => c.classList.toggle('selected', c.dataset.type === type));
    if (typeInput) typeInput.value = type;
    conditionalFields.forEach(f => f.classList.toggle('show', f.dataset.showFor === type));
  }

  typeCards.forEach(card => card.addEventListener('click', () => selectType(card.dataset.type)));

  // Pré-sélection via ?type=xxx dans l'URL
  const preType = new URLSearchParams(window.location.search).get('type');
  if (preType) selectType(preType);

  /* ── 11. Slider parts ──────────────────────────────────── */
  const partsRange   = document.getElementById('parts-range');
  const partsDisplay = document.getElementById('parts-display');
  if (partsRange && partsDisplay) {
    partsRange.addEventListener('input', () => {
      partsDisplay.textContent = partsRange.value + '%';
    });
  }

  /* ── 12. Validation formulaire ─────────────────────────── */
  function showError(input, msg) {
    input.classList.add('error');
    const err = input.parentElement.querySelector('.form-error');
    if (err) { err.textContent = msg; err.classList.add('show'); }
  }
  function clearError(input) {
    input.classList.remove('error');
    const err = input.parentElement.querySelector('.form-error');
    if (err) err.classList.remove('show');
  }
  document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(input => {
    input.addEventListener('input', () => clearError(input));
  });

  function validateCurrentStep() {
    const currentEl = steps[currentStep];
    if (!currentEl) return true;
    let valid = true;

    // Étape 1 : type sélectionné
    if (currentStep === 0) {
      const hasType = typeInput && typeInput.value;
      const err = document.querySelector('.type-error');
      if (!hasType) { err?.classList.add('show'); valid = false; }
      else           err?.classList.remove('show');
      return valid;
    }

    // Autres étapes : champs required
    currentEl.querySelectorAll('[required]').forEach(input => {
      if (input.type === 'radio') {
        const group = currentEl.querySelectorAll(`[name="${input.name}"]`);
        const checked = Array.from(group).some(r => r.checked);
        if (!checked) valid = false;
      } else if (!input.value.trim()) {
        showError(input, 'Ce champ est obligatoire.');
        valid = false;
      } else {
        clearError(input);
      }
    });

    // Validation email optionnel
    const emailInput = currentEl.querySelector('input[type="email"]:not([required])');
    if (emailInput && emailInput.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value)) {
      showError(emailInput, 'Adresse email invalide.');
      valid = false;
    }

    if (!valid) {
      // Shake le formulaire
      const card = currentEl.querySelector('.form-card');
      if (card) {
        card.style.animation = 'none';
        requestAnimationFrame(() => {
          card.style.animation = 'shake 0.4s cubic-bezier(0.36,0.07,0.19,0.97)';
        });
      }
    }
    return valid;
  }

  /* ── 13. Récapitulatif ─────────────────────────────────── */
  function updateRecap() {
    const recap = document.querySelector('.recap');
    if (!recap || currentStep < 3) return;

    const typeMap = {
      prevente:       '📦 Prévente',
      dons:           '🤝 Dons & Soutien',
      investissement: '📈 Investissement'
    };
    const g = id => { const el = document.getElementById(id); return el ? el.value : ''; };

    const rows = [
      ['Type de financement',  typeMap[g('selected-type')] || '—'],
      ['Prénom & Nom',         `${g('prenom')} ${g('nom')}`.trim() || '—'],
      ['Île / Région',         g('ile') || '—'],
      ['WhatsApp',             g('tel') || '—'],
      ['Nom du projet',        g('nom-projet') || '—'],
      ['Secteur',              g('secteur') || '—'],
      ['Montant recherché',    g('montant') ? `${parseInt(g('montant')).toLocaleString('fr-FR')} KMF` : '—'],
      ['Durée de collecte',    g('duree') ? `${g('duree')} jours` : '—'],
    ];

    recap.innerHTML = rows.map(([label, val]) => `
      <div class="recap__row">
        <span class="recap__label">${label}</span>
        <span class="recap__value">${val}</span>
      </div>`).join('');
  }

  /* ── 14. Soumission formulaire ─────────────────────────── */
  const mainForm = document.getElementById('candidature-form');
  if (mainForm) {
    mainForm.addEventListener('submit', e => {
      e.preventDefault();
      const cgv = document.getElementById('cgv');
      if (cgv && !cgv.checked) {
        const label = cgv.closest('.form-check') || cgv.parentElement;
        label.style.color = '#DC2626';
        setTimeout(() => label.style.color = '', 2000);
        return;
      }
      openModal('modal-success');
    });
  }

  /* ── 15. Modals ────────────────────────────────────────── */
  function openModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  window.openModal  = openModal;
  window.closeModal = closeModal;

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
  document.querySelectorAll('.modal__close').forEach(btn => {
    btn.addEventListener('click', () => {
      const overlay = btn.closest('.modal-overlay');
      if (overlay) closeModal(overlay.id);
    });
  });
  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.openModal));
  });

  /* Fermeture Escape */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(o => closeModal(o.id));
    }
  });

  /* ── 16. Sélection montant + paiement ──────────────────── */
  document.querySelectorAll('.amount-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.amount-grid').querySelectorAll('.amount-btn')
        .forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const input = btn.closest('.modal')?.querySelector('#custom-amount');
      if (input && btn.dataset.amount) input.value = btn.dataset.amount;
    });
  });

  document.querySelectorAll('.payment-option').forEach(opt => {
    opt.addEventListener('click', () => {
      opt.closest('.payment-options').querySelectorAll('.payment-option')
        .forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  const donForm = document.getElementById('don-form');
  if (donForm) {
    donForm.addEventListener('submit', e => {
      e.preventDefault();
      closeModal('modal-soutien');
      setTimeout(() => openModal('modal-don-success'), 350);
    });
  }

  /* ── 17. Tabs détail projet ────────────────────────────── */
  document.querySelectorAll('[data-tabs]').forEach(container => {
    container.querySelectorAll('.detail-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        container.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        container.querySelectorAll('.detail-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const content = container.querySelector(`[data-tab-content="${target}"]`);
        if (content) content.classList.add('active');
      });
    });
  });

  /* ── 18. Newsletter (câblée sur l'API) ─────────────────── */
  document.querySelectorAll('.newsletter-form, form.newsletter__form').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      if (!input?.value) return;
      const btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = '…'; }
      try {
        if (typeof API !== 'undefined') {
          await API.newsletter(input.value);
        }
        form.innerHTML = `
          <p style="color:var(--gold);font-weight:700;font-size:1rem;letter-spacing:-0.01em;">
            ✅ Merci ! Vous êtes inscrit(e) à notre newsletter.
          </p>`;
      } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = 'S\'inscrire'; }
        // Affiche quand même le message de succès si le backend n'est pas démarré
        if (err.status === 0 || err.status === 409) {
          form.innerHTML = `<p style="color:var(--gold);font-weight:700;font-size:1rem;">✅ Merci pour votre inscription !</p>`;
        }
      }
    });
  });

  /* ── 19. Tactile feedback : active sur tous les boutons ── */
  // Le CSS gère :active, mais on s'assure que les touch events fonctionnent
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('touchstart', () => {}, { passive: true });
  });

  /* ── 20. Initialisation stepper ────────────────────────── */
  if (steps.length) goToStep(0);

  /* ── 21. Shake animation (CSS) ─────────────────────────── */
  const shakeStyle = document.createElement('style');
  shakeStyle.textContent = `
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      15%      { transform: translateX(-6px); }
      30%      { transform: translateX(5px); }
      45%      { transform: translateX(-4px); }
      60%      { transform: translateX(3px); }
      75%      { transform: translateX(-2px); }
      90%      { transform: translateX(1px); }
    }
  `;
  document.head.appendChild(shakeStyle);

});
