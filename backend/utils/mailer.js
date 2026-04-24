/* ============================================================
   FaidaKomori — mailer.js
   Service d'envoi d'emails via Gmail (Nodemailer)
   Sender : athoumaniyas@gmail.com
   ============================================================ */

const nodemailer = require('nodemailer');

const SITE_URL   = process.env.SITE_URL || 'https://faidakomori.onrender.com';
const EMAIL_USER = process.env.EMAIL_USER || 'athoumaniyas@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || '';

/* ── Transporter Gmail ─────────────────────────────────────── */
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });
  }
  return transporter;
}

/* ── Template HTML de base (wrapper) ─────────────────────────
   Reprend les couleurs FaidaKomori : Navy #0D2244, Green #00C853, Gold #E8A020
   ─────────────────────────────────────────────────────────── */
function baseTemplate({ title, preheader, body }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #F3F4F6; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(13,34,68,0.10); }
    .header { background: #0D2244; padding: 28px 32px; text-align: center; }
    .header__logo { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.03em; }
    .header__logo span { color: #00C853; }
    .header__sub { font-size: 12px; color: rgba(255,255,255,0.45); margin-top: 4px; letter-spacing: 0.06em; text-transform: uppercase; }
    .stripe { height: 4px; background: linear-gradient(90deg, #00C853, #E8A020); }
    .body { padding: 36px 32px; }
    .body h2 { font-size: 20px; font-weight: 700; color: #0D2244; margin-bottom: 12px; letter-spacing: -0.02em; }
    .body p { font-size: 15px; color: #374151; line-height: 1.75; margin-bottom: 14px; }
    .body p.muted { font-size: 13px; color: #9CA3AF; }
    .btn-wrap { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; padding: 14px 32px; background: #00C853; color: #fff !important; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 15px; letter-spacing: -0.01em; box-shadow: 0 4px 16px rgba(0,200,83,0.30); }
    .btn--navy { background: #0D2244; box-shadow: 0 4px 16px rgba(13,34,68,0.22); }
    .btn--gold  { background: #E8A020; box-shadow: 0 4px 16px rgba(232,160,32,0.25); }
    .infobox { background: #F0FDF4; border: 1px solid rgba(0,200,83,0.25); border-radius: 12px; padding: 16px 20px; margin: 20px 0; }
    .infobox--warn { background: #FFFBEB; border-color: rgba(232,160,32,0.35); }
    .infobox--danger { background: #FEF2F2; border-color: rgba(220,38,38,0.25); }
    .infobox p { margin: 0; font-size: 14px; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #E5E7EB; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .info-row .label { color: #6B7280; font-weight: 500; }
    .info-row .value { color: #0D2244; font-weight: 600; }
    .footer { background: #081729; padding: 20px 32px; text-align: center; }
    .footer p { font-size: 12px; color: rgba(255,255,255,0.3); line-height: 1.8; }
    .footer a { color: rgba(255,255,255,0.5); text-decoration: none; }
    @media (max-width: 600px) {
      .wrapper { margin: 0; border-radius: 0; }
      .body { padding: 24px 20px; }
      .header { padding: 20px; }
    }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
  <div class="wrapper">
    <div class="header">
      <div class="header__logo">Faida<span>Komori</span></div>
      <div class="header__sub">Plateforme de financement participatif 🇰🇲</div>
    </div>
    <div class="stripe"></div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      <p>© 2025 FaidaKomori · Union des Comores 🇰🇲<br/>
      <a href="${SITE_URL}">${SITE_URL}</a><br/>
      Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
    </div>
  </div>
</body>
</html>`;
}

/* ── Fonction d'envoi principale ─────────────────────────────── */
async function sendMail({ to, subject, html, text }) {
  if (!EMAIL_PASS || EMAIL_PASS === 'VOTRE_APP_PASSWORD_ICI') {
    console.warn(`[Mailer] ⚠️  App Password non configuré. Email NON envoyé à ${to}`);
    console.warn(`[Mailer]    Sujet : ${subject}`);
    return { skipped: true };
  }
  try {
    const info = await getTransporter().sendMail({
      from: `"FaidaKomori" <${EMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || subject,
    });
    console.log(`[Mailer] ✅ Email envoyé à ${to} — ID: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[Mailer] ❌ Erreur envoi à ${to} :`, err.message);
    return { error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   TEMPLATES SPÉCIALISÉS
══════════════════════════════════════════════════════════════ */

/* ── 1. Réinitialisation du mot de passe ───────────────────── */
async function sendResetPassword({ to, prenom, resetUrl }) {
  const fullUrl = resetUrl.startsWith('http') ? resetUrl : `${SITE_URL}${resetUrl}`;
  const html = baseTemplate({
    title: 'Réinitialisation de votre mot de passe — FaidaKomori',
    preheader: 'Cliquez sur le lien pour créer un nouveau mot de passe.',
    body: `
      <h2>🔑 Réinitialisation de mot de passe</h2>
      <p>Bonjour <strong>${prenom}</strong>,</p>
      <p>Vous avez demandé à réinitialiser votre mot de passe sur FaidaKomori. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
      <div class="btn-wrap">
        <a href="${fullUrl}" class="btn">Réinitialiser mon mot de passe</a>
      </div>
      <div class="infobox infobox--warn">
        <p>⏱️ Ce lien est valide pendant <strong>1 heure</strong>. Après ce délai, vous devrez faire une nouvelle demande.</p>
      </div>
      <p class="muted">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email — votre mot de passe reste inchangé.</p>
      <p class="muted">Lien direct : <a href="${fullUrl}">${fullUrl}</a></p>
    `,
  });
  return sendMail({
    to,
    subject: '🔑 Réinitialisation de votre mot de passe FaidaKomori',
    html,
    text: `Réinitialisation mot de passe FaidaKomori\n\nBonjour ${prenom},\n\nCliquez sur ce lien pour réinitialiser votre mot de passe (valide 1h) :\n${fullUrl}\n\nSi vous n'avez pas fait cette demande, ignorez cet email.`,
  });
}

/* ── 2. Bienvenue (inscription) ────────────────────────────── */
async function sendWelcome({ to, prenom }) {
  const html = baseTemplate({
    title: 'Bienvenue sur FaidaKomori !',
    preheader: 'Votre compte a été créé avec succès.',
    body: `
      <h2>🎉 Bienvenue sur FaidaKomori, ${prenom} !</h2>
      <p>Votre compte a été créé avec succès. Vous pouvez maintenant :</p>
      <ul style="margin:14px 0 14px 20px;line-height:2;">
        <li>Déposer vos projets pour les financer</li>
        <li>Contribuer aux projets d'autres porteurs</li>
        <li>Suivre vos investissements et dons</li>
      </ul>
      <div class="btn-wrap">
        <a href="${SITE_URL}/mon-espace.html" class="btn">Accéder à mon espace</a>
      </div>
      <p class="muted">Une question ? Répondez à cet email ou contactez-nous via le site.</p>
    `,
  });
  return sendMail({
    to,
    subject: '🎉 Bienvenue sur FaidaKomori !',
    html,
    text: `Bienvenue sur FaidaKomori, ${prenom} !\n\nVotre compte a été créé avec succès.\nAccédez à votre espace : ${SITE_URL}/mon-espace.html`,
  });
}

/* ── 3. Confirmation dépôt de projet ───────────────────────── */
async function sendProjetRecu({ to, prenom, nomProjet, type }) {
  const typeLabels = { prevente: 'Prévente', dons: 'Dons / Crowdfunding', investissement: 'Investissement' };
  const html = baseTemplate({
    title: `Projet "${nomProjet}" reçu — FaidaKomori`,
    preheader: `Votre dossier "${nomProjet}" est en cours d'examen.`,
    body: `
      <h2>📋 Votre projet a été reçu !</h2>
      <p>Bonjour <strong>${prenom}</strong>,</p>
      <p>Nous avons bien reçu votre dossier de financement. Notre équipe l'examinera dans les <strong>72 heures ouvrées</strong>.</p>
      <div style="background:#F9FAFB;border-radius:12px;padding:20px;margin:20px 0;">
        <div class="info-row"><span class="label">Projet</span><span class="value">${nomProjet}</span></div>
        <div class="info-row"><span class="label">Modèle</span><span class="value">${typeLabels[type] || type}</span></div>
        <div class="info-row"><span class="label">Statut</span><span class="value" style="color:#00C853;">✅ Dossier reçu</span></div>
      </div>
      <div class="infobox">
        <p>📱 Nous vous contacterons par email ou WhatsApp dès que votre dossier sera examiné.</p>
      </div>
      <div class="btn-wrap">
        <a href="${SITE_URL}/mon-espace.html" class="btn btn--navy">Suivre mon dossier</a>
      </div>
    `,
  });
  return sendMail({
    to,
    subject: `📋 Dossier "${nomProjet}" reçu — FaidaKomori`,
    html,
    text: `Bonjour ${prenom},\n\nVotre projet "${nomProjet}" a bien été reçu. Notre équipe l'examinera dans les 72h ouvrées.\n\nSuivez votre dossier : ${SITE_URL}/mon-espace.html`,
  });
}

/* ── 4. Changement de statut de projet ─────────────────────── */
async function sendStatutProjet({ to, prenom, nomProjet, status, noteAdmin }) {
  const configs = {
    review: {
      emoji: '🔍', title: 'Votre dossier est en cours d\'examen',
      color: '#3B82F6', colorBg: '#EFF6FF', borderColor: 'rgba(59,130,246,0.25)',
      msg: `Notre équipe analyse actuellement votre dossier <strong>"${nomProjet}"</strong>. Vous serez contacté très prochainement.`,
      subject: `🔍 Votre projet "${nomProjet}" est en cours d'examen`,
    },
    interview: {
      emoji: '🗓️', title: 'Entretien souhaité !',
      color: '#E8A020', colorBg: '#FFFBEB', borderColor: 'rgba(232,160,32,0.35)',
      msg: `Bonne nouvelle ! Suite à l'analyse de votre dossier <strong>"${nomProjet}"</strong>, nous souhaitons vous rencontrer pour en discuter. Consultez votre espace pour les détails de l'entretien.`,
      subject: `🗓️ Entretien pour votre projet "${nomProjet}" — FaidaKomori`,
    },
    approved: {
      emoji: '✅', title: 'Projet approuvé !',
      color: '#00C853', colorBg: '#F0FDF4', borderColor: 'rgba(0,200,83,0.25)',
      msg: `Félicitations ! Votre projet <strong>"${nomProjet}"</strong> a été approuvé par notre équipe. Il sera bientôt publié sur la plateforme.`,
      subject: `✅ Projet "${nomProjet}" approuvé — FaidaKomori`,
    },
    published: {
      emoji: '🚀', title: 'Votre projet est en ligne !',
      color: '#00C853', colorBg: '#F0FDF4', borderColor: 'rgba(0,200,83,0.25)',
      msg: `Votre projet <strong>"${nomProjet}"</strong> est maintenant visible sur FaidaKomori et ouvert aux contributions. Partagez-le autour de vous !`,
      subject: `🚀 Projet "${nomProjet}" publié sur FaidaKomori !`,
    },
    rejected: {
      emoji: '❌', title: 'Décision sur votre dossier',
      color: '#DC2626', colorBg: '#FEF2F2', borderColor: 'rgba(220,38,38,0.25)',
      msg: `Après examen, votre dossier <strong>"${nomProjet}"</strong> n'a pas pu être retenu à ce stade.${noteAdmin ? ` <br/><br/><em>Motif : ${noteAdmin}</em>` : ''} N'hésitez pas à nous recontacter pour améliorer votre dossier.`,
      subject: `Décision sur votre projet "${nomProjet}" — FaidaKomori`,
    },
  };

  const cfg = configs[status];
  if (!cfg) return;

  const html = baseTemplate({
    title: cfg.subject,
    preheader: cfg.msg.replace(/<[^>]+>/g, ''),
    body: `
      <h2>${cfg.emoji} ${cfg.title}</h2>
      <p>Bonjour <strong>${prenom}</strong>,</p>
      <div class="infobox" style="background:${cfg.colorBg};border-color:${cfg.borderColor};">
        <p style="color:#111;">${cfg.msg}</p>
      </div>
      ${status === 'published' ? `
        <div class="btn-wrap">
          <a href="${SITE_URL}/projets.html" class="btn" style="background:${cfg.color};">Voir mon projet en ligne</a>
        </div>` : `
        <div class="btn-wrap">
          <a href="${SITE_URL}/mon-espace.html" class="btn btn--navy">Voir mon espace</a>
        </div>`}
      <p class="muted">Une question ? Contactez-nous via ${SITE_URL}</p>
    `,
  });

  return sendMail({ to, subject: cfg.subject, html,
    text: `${cfg.emoji} ${cfg.title}\n\nBonjour ${prenom},\n\n${cfg.msg.replace(/<[^>]+>/g,'')}\n\nMon espace : ${SITE_URL}/mon-espace.html`,
  });
}

/* ── 5. Entretien planifié (détails complets) ───────────────── */
async function sendEntretienPlanifie({ to, prenom, nomProjet, date, heure, typeEntretien, lien, duree, notes }) {
  const typeLabels = {
    google_meet: '📹 Google Meet',
    zoom: '📹 Zoom',
    whatsapp: '📱 WhatsApp Video',
    phone: '📞 Appel téléphonique',
    inperson: '📍 Présentiel — Moroni',
  };
  const typeLabel = typeLabels[typeEntretien] || typeEntretien || 'Entretien';
  const dateFormatted = new Date(date).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  const html = baseTemplate({
    title: `Entretien planifié — ${nomProjet}`,
    preheader: `Votre entretien est fixé au ${dateFormatted} à ${heure}.`,
    body: `
      <h2>🗓️ Entretien planifié !</h2>
      <p>Bonjour <strong>${prenom}</strong>,</p>
      <p>Nous avons planifié un entretien concernant votre projet <strong>"${nomProjet}"</strong>. Voici les détails :</p>
      <div style="background:#F9FAFB;border-radius:12px;padding:20px;margin:20px 0;">
        <div class="info-row"><span class="label">📅 Date</span><span class="value">${dateFormatted}</span></div>
        <div class="info-row"><span class="label">⏰ Heure</span><span class="value">${heure} (heure de Moroni)</span></div>
        <div class="info-row"><span class="label">📡 Type</span><span class="value">${typeLabel}</span></div>
        ${duree ? `<div class="info-row"><span class="label">⏱️ Durée</span><span class="value">${duree}</span></div>` : ''}
        ${lien ? `<div class="info-row"><span class="label">🔗 Lien</span><span class="value"><a href="${lien}" style="color:#00C853;">${lien}</a></span></div>` : ''}
      </div>
      ${notes ? `<div class="infobox infobox--warn"><p>📝 <strong>Notes de l'équipe :</strong> ${notes}</p></div>` : ''}
      ${lien ? `<div class="btn-wrap"><a href="${lien}" class="btn">Rejoindre l'entretien</a></div>` : ''}
      <p>En cas d'empêchement, contactez-nous dès que possible.</p>
      <p class="muted">Projet : "${nomProjet}" · FaidaKomori</p>
    `,
  });

  return sendMail({
    to,
    subject: `🗓️ Entretien "${nomProjet}" — ${dateFormatted} à ${heure}`,
    html,
    text: `Entretien planifié\n\nBonjour ${prenom},\n\nEntretien pour "${nomProjet}"\nDate : ${dateFormatted} à ${heure}\nType : ${typeLabel}\n${lien ? 'Lien : ' + lien : ''}\n${notes ? 'Notes : ' + notes : ''}`,
  });
}

/* ── 6. Notification admin (nouveau projet reçu) ────────────── */
async function sendAdminNouveauProjet({ to, nomProjet, porteurNom, type, montant }) {
  const typeLabels = { prevente: 'Prévente', dons: 'Dons', investissement: 'Investissement' };
  const html = baseTemplate({
    title: `Nouveau projet soumis — ${nomProjet}`,
    preheader: `${porteurNom} vient de soumettre "${nomProjet}"`,
    body: `
      <h2>📥 Nouveau dossier reçu</h2>
      <p>Un nouveau projet vient d'être soumis sur FaidaKomori :</p>
      <div style="background:#F9FAFB;border-radius:12px;padding:20px;margin:20px 0;">
        <div class="info-row"><span class="label">Projet</span><span class="value">${nomProjet}</span></div>
        <div class="info-row"><span class="label">Porteur</span><span class="value">${porteurNom}</span></div>
        <div class="info-row"><span class="label">Modèle</span><span class="value">${typeLabels[type] || type}</span></div>
        <div class="info-row"><span class="label">Montant cible</span><span class="value">${parseInt(montant || 0).toLocaleString('fr-FR')} KMF</span></div>
      </div>
      <div class="btn-wrap">
        <a href="${SITE_URL}/admin.html" class="btn btn--gold">Voir dans l'administration</a>
      </div>
    `,
  });
  return sendMail({
    to,
    subject: `📥 Nouveau projet : "${nomProjet}" — FaidaKomori Admin`,
    html,
    text: `Nouveau projet soumis sur FaidaKomori\n\nProjet : ${nomProjet}\nPorteur : ${porteurNom}\nType : ${type}\nMontant : ${montant} KMF\n\nAdmin : ${SITE_URL}/admin.html`,
  });
}

/* ── 7. Confirmation versement ──────────────────────────────── */
async function sendVersement({ to, prenom, nomProjet, montant, status }) {
  const configs = {
    approved: { emoji:'✅', msg: `Votre demande de versement de <strong>${parseInt(montant).toLocaleString('fr-FR')} KMF</strong> pour le projet <strong>"${nomProjet}"</strong> a été approuvée. Le virement sera effectué sous 2-3 jours ouvrés.`, subject: '✅ Demande de versement approuvée' },
    versed:   { emoji:'💸', msg: `Le versement de <strong>${parseInt(montant).toLocaleString('fr-FR')} KMF</strong> pour le projet <strong>"${nomProjet}"</strong> a été effectué avec succès !`, subject: '💸 Versement effectué — FaidaKomori' },
    refused:  { emoji:'❌', msg: `Votre demande de versement pour le projet <strong>"${nomProjet}"</strong> n'a pas pu être traitée. Contactez-nous pour plus d'informations.`, subject: 'Décision sur votre demande de versement' },
  };
  const cfg = configs[status];
  if (!cfg) return;
  const html = baseTemplate({
    title: cfg.subject,
    preheader: cfg.msg.replace(/<[^>]+>/g, ''),
    body: `
      <h2>${cfg.emoji} ${cfg.subject}</h2>
      <p>Bonjour <strong>${prenom}</strong>,</p>
      <div class="infobox ${status === 'refused' ? 'infobox--danger' : ''}">
        <p>${cfg.msg}</p>
      </div>
      <div class="btn-wrap">
        <a href="${SITE_URL}/mon-espace.html" class="btn btn--navy">Mon espace</a>
      </div>
    `,
  });
  return sendMail({ to, subject: cfg.subject, html, text: `${cfg.emoji} ${cfg.subject}\n\nBonjour ${prenom},\n\n${cfg.msg.replace(/<[^>]+>/g,'')}\n\nMon espace : ${SITE_URL}/mon-espace.html` });
}

module.exports = {
  sendResetPassword,
  sendWelcome,
  sendProjetRecu,
  sendStatutProjet,
  sendEntretienPlanifie,
  sendAdminNouveauProjet,
  sendVersement,
  sendMail,
};
