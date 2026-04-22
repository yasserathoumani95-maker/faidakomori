/* ============================================================
   FaidaKomori — server.js
   Express API  ·  Port 3001  ·  SQLite via better-sqlite3
   ============================================================ */

// Charger les variables d'environnement (.env) en premier
require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

// Initialise la base de données au démarrage
require('./database');

const authRoutes     = require('./routes/auth');
const projectRoutes  = require('./routes/projects');
const adminRoutes    = require('./routes/admin');
const userRoutes     = require('./routes/user');
const deposerRoutes  = require('./routes/deposer');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Sécurité ─────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false  // désactivé pour servir les fichiers statiques
}));

// CORS : autorise le front (local + Render + même origine)
const allowedOrigins = [
  'http://localhost:3001', 'http://127.0.0.1:3001',
  'http://localhost:3000', 'http://127.0.0.1:3000',
  'http://localhost:5500', 'http://127.0.0.1:5500',
  'https://faidakomori.onrender.com',
  'null'
];
app.use(cors({
  origin: (origin, cb) => {
    // Pas d'origine = requête directe (Postman, curl) ou même origine
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, true); // Accepter toutes les origines en prod (front servi par Express)
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting — protection brute force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, veuillez réessayer dans quelques minutes.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de tentatives de connexion. Veuillez patienter 15 minutes.' }
});

app.use(limiter);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Servir les fichiers statiques du front ───────────────────
app.use(express.static(path.join(__dirname, '..')));

// ── Routes API ───────────────────────────────────────────────
app.use('/api/auth',     authLimiter, authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/user',     userRoutes);
app.use('/api/deposer',  deposerRoutes);

// Route newsletter publique
app.post('/api/newsletter', (req, res) => {
  const db = require('./database');
  const { isValidEmail } = require('./utils/auth');
  const { email } = req.body;
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Email invalide.' });
  }
  try {
    db.prepare(`INSERT INTO newsletter (email) VALUES (?)`).run(email.toLowerCase());
    res.json({ success: true, message: 'Inscription confirmée !' });
  } catch {
    res.status(409).json({ error: 'Cet email est déjà inscrit.' });
  }
});

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', platform: 'FaidaKomori' });
});

// ── 404 API ──────────────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route API introuvable.' });
});

// ── SPA fallback (toutes les autres routes → index.html) ─────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERREUR]', err.message);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

app.listen(PORT, () => {
  console.log(`\n✅  FaidaKomori API démarrée`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → Admin : admin@faidakomori.km / Admin@FK2024!\n`);
});
