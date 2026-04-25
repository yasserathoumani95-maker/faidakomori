/* ============================================================
   FaidaKomori — server.js
   Express API  ·  Port 3001  ·  SQLite via sql.js / Turso
   ============================================================ */

require('dotenv').config();
require('express-async-errors'); // capture automatique des erreurs async

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
const db          = require('./database');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Sécurité ─────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin: (origin, cb) => cb(null, true),
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de requêtes, veuillez réessayer dans quelques minutes.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { error: 'Trop de tentatives de connexion. Veuillez patienter 15 minutes.' }
});

app.use(limiter);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..')));

// ── Routes API ───────────────────────────────────────────────
app.use('/api/auth',     authLimiter, require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/user',     require('./routes/user'));
app.use('/api/deposer',  require('./routes/deposer'));

app.post('/api/newsletter', async (req, res) => {
  const { isValidEmail } = require('./utils/auth');
  const { email } = req.body;
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Email invalide.' });
  }
  try {
    await db.prepare(`INSERT INTO newsletter (email) VALUES (?)`).run(email.toLowerCase());
    res.json({ success: true, message: 'Inscription confirmée !' });
  } catch {
    res.status(409).json({ error: 'Cet email est déjà inscrit.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', platform: 'FaidaKomori' });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route API introuvable.' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── Gestionnaire d'erreurs global ────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERREUR]', err.message);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

// ── Démarrage : initialiser la DB d'abord, puis écouter ──────
db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`\n✅  FaidaKomori API démarrée`);
    console.log(`   → http://localhost:${PORT}`);
    console.log(`   → Admin : admin@faidakomori.km / Admin@FK2024!\n`);
  });
}).catch(err => {
  console.error('❌ Erreur démarrage DB:', err);
  process.exit(1);
});
