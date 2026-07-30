/* ============================================================
   Utilitaires Auth partagés — signToken + constantes JWT
   ============================================================ */

const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET || 'fk_secret_dev_change_in_prod_2024';
const JWT_EXPIRES = '7d';

/**
 * Génère un JWT signé pour l'utilisateur donné.
 * @param {object} user — objet utilisateur avec id, email, role, nom, prenom
 * @returns {string} token JWT
 */
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, nom: user.nom, prenom: user.prenom },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

/**
 * Valide le format d'une adresse email.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Valide une image en data URL (JPEG/PNG/WebP, base64, ≤ ~600 Ko encodé).
 * Utilisé pour la photo de projet stockée en base.
 * @param {string} dataUrl
 * @returns {boolean}
 */
function isValidImageDataUrl(dataUrl) {
  return typeof dataUrl === 'string'
    && dataUrl.length <= 800_000
    && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl);
}

module.exports = { signToken, JWT_SECRET, JWT_EXPIRES, isValidEmail, isValidImageDataUrl };
