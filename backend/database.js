/* ============================================================
   FaidaKomori — database.js
   Double backend :
     · sql.js  (WASM, zéro compilation) → développement local
     · PostgreSQL via pg               → production (Neon, Supabase…)
   API unifiée async : db.prepare(sql).get/all/run(...args)
   ============================================================ */

const bcrypt = require('bcryptjs');
const path   = require('path');
const fs     = require('fs');

let impl = null;

/* ── Convertit les ? SQLite en $1 $2 … PostgreSQL ────────── */
function pgSql(sql) {
  let i = 0;
  return sql
    .replace(/\?/g, () => `$${++i}`)
    // SQLite datetime → PostgreSQL texte compatible
    .replace(/CURRENT_TIMESTAMP/g,
      "to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')")
    .replace(/datetime\('now'\)/gi,
      "to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')");
}

/* ── SCHÉMA SQLite (sql.js local) ────────────────────────── */
const TABLES_SQLITE = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL, prenom TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    tel TEXT, ile TEXT,
    paiement_tel TEXT, paiement_banque TEXT, paiement_rib TEXT,
    reset_token TEXT, reset_token_expires TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
    type TEXT NOT NULL, nom_projet TEXT NOT NULL,
    description TEXT, secteur TEXT,
    montant INTEGER DEFAULT 0, duree INTEGER DEFAULT 30,
    montant_collecte INTEGER DEFAULT 0, nb_contributeurs INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new', note_admin TEXT, image_url TEXT,
    budget_lien TEXT, budget_description TEXT, contrepartie TEXT,
    parts_pourcentage REAL, valeur_entreprise INTEGER,
    impact TEXT, entreprise TEXT, ile TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL,
    user_id INTEGER, nom_contributeur TEXT,
    montant INTEGER NOT NULL, methode_paiement TEXT DEFAULT 'mvola',
    message TEXT, anonyme INTEGER DEFAULT 0,
    coordonnees_paiement TEXT, livraison_status TEXT, parts_pourcentage REAL,
    statut_paiement TEXT NOT NULL DEFAULT 'en_attente',
    reference TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    message TEXT NOT NULL, lien TEXT, lu INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS newsletter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS versements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    montant_demande INTEGER NOT NULL, montant_verse INTEGER,
    motif TEXT, status TEXT NOT NULL DEFAULT 'pending', note_admin TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT)`,
];

/* ── SCHÉMA PostgreSQL (Neon/production) ─────────────────── */
const NOW_TEXT = `to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`;
const TABLES_PG = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    nom TEXT NOT NULL, prenom TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    tel TEXT, ile TEXT,
    paiement_tel TEXT, paiement_banque TEXT, paiement_rib TEXT,
    reset_token TEXT, reset_token_expires TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW_TEXT}, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY, user_id INTEGER,
    type TEXT NOT NULL, nom_projet TEXT NOT NULL,
    description TEXT, secteur TEXT,
    montant INTEGER DEFAULT 0, duree INTEGER DEFAULT 30,
    montant_collecte INTEGER DEFAULT 0, nb_contributeurs INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new', note_admin TEXT, image_url TEXT,
    budget_lien TEXT, budget_description TEXT, contrepartie TEXT,
    parts_pourcentage FLOAT, valeur_entreprise INTEGER,
    impact TEXT, entreprise TEXT, ile TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW_TEXT}, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS contributions (
    id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL,
    user_id INTEGER, nom_contributeur TEXT,
    montant INTEGER NOT NULL, methode_paiement TEXT DEFAULT 'mvola',
    message TEXT, anonyme INTEGER DEFAULT 0,
    coordonnees_paiement TEXT, livraison_status TEXT, parts_pourcentage FLOAT,
    statut_paiement TEXT NOT NULL DEFAULT 'en_attente',
    reference TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW_TEXT}, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
    message TEXT NOT NULL, lien TEXT, lu INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT ${NOW_TEXT})`,
  `CREATE TABLE IF NOT EXISTS newsletter (
    id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW_TEXT})`,
  `CREATE TABLE IF NOT EXISTS versements (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    montant_demande INTEGER NOT NULL, montant_verse INTEGER,
    motif TEXT, status TEXT NOT NULL DEFAULT 'pending', note_admin TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW_TEXT}, updated_at TEXT)`,
];

/* ── API publique ─────────────────────────────────────────── */
const db = {
  prepare(sql) {
    return {
      async get(...args)  { return impl.get(sql, args); },
      async all(...args)  { return impl.all(sql, args); },
      async run(...args)  { return impl.run(sql, args); },
    };
  },
  async exec(sql)  { return impl.exec(sql); },
  pragma()         { /* no-op */ },
};

/* ══════════════════════════════════════════════════════════
   BACKEND 1 — PostgreSQL (Neon, Supabase, …)
   Activé quand DATABASE_URL est défini
══════════════════════════════════════════════════════════ */
async function initPostgres(connectionString) {
  const pg = require('pg');

  // Retourner les bigint/numeric en nombres JS (pas en string)
  pg.types.setTypeParser(20,  parseInt);   // INT8 / bigint
  pg.types.setTypeParser(1700, parseFloat); // NUMERIC

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  async function query(sql, args = []) {
    const client = await pool.connect();
    try {
      return await client.query(pgSql(sql), args);
    } finally {
      client.release();
    }
  }

  impl = {
    async get(sql, args) {
      const r = await query(sql, args);
      return r.rows[0] || undefined;
    },
    async all(sql, args) {
      const r = await query(sql, args);
      return r.rows;
    },
    async run(sql, args) {
      const r = await query(sql, args);
      let lastInsertRowid = null;
      if (sql.trim().toUpperCase().startsWith('INSERT')) {
        try {
          const id = await pool.query('SELECT lastval()');
          lastInsertRowid = Number(id.rows[0].lastval);
        } catch { /* table sans séquence */ }
      }
      return { lastInsertRowid, changes: r.rowCount || 0 };
    },
    async exec(sql) {
      const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of stmts) await pool.query(stmt);
    },
  };

  // Créer les tables
  for (const table of TABLES_PG) await pool.query(table);

  // Migrations — colonnes ajoutées après création initiale
  const migrationsPG = [
    `ALTER TABLE contributions ADD COLUMN IF NOT EXISTS statut_paiement TEXT NOT NULL DEFAULT 'en_attente'`,
    `ALTER TABLE contributions ADD COLUMN IF NOT EXISTS reference TEXT`,
  ];
  for (const m of migrationsPG) { try { await pool.query(m); } catch {} }

  // Compte admin
  const adminRes = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!adminRes.rows.length) {
    const hash = bcrypt.hashSync('Admin@FK2024!', 12);
    await pool.query(
      "INSERT INTO users (nom, prenom, email, password_hash, role) VALUES ($1,$2,$3,$4,'admin')",
      ['Admin', 'FaidaKomori', 'admin@faidakomori.km', hash]
    );
    console.log('[DB] Compte admin créé → admin@faidakomori.km / Admin@FK2024!');
  }

  console.log('[DB] ✅ Connecté à PostgreSQL (Neon)');
}

/* ══════════════════════════════════════════════════════════
   BACKEND 2 — sql.js WASM (développement local)
   Activé quand DATABASE_URL n'est pas défini
══════════════════════════════════════════════════════════ */
async function initSqlJsLocal() {
  const initSqlJsFn = require('sql.js');
  const DB_DIR  = path.join(__dirname, 'db');
  const DB_PATH = path.join(DB_DIR, 'faidakomori.db');
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  const SQL = await initSqlJsFn();
  let sqlDb;

  if (fs.existsSync(DB_PATH)) {
    sqlDb = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log('[DB] Base SQLite locale chargée →', DB_PATH);
  } else {
    sqlDb = new SQL.Database();
    console.log('[DB] Nouvelle base SQLite locale →', DB_PATH);
  }

  function saveDb() {
    try { fs.writeFileSync(DB_PATH, Buffer.from(sqlDb.export())); }
    catch (e) { console.error('[DB] Erreur sauvegarde:', e.message); }
  }

  impl = {
    async get(sql, args) {
      const stmt = sqlDb.prepare(sql);
      stmt.bind(args);
      const row = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return row;
    },
    async all(sql, args) {
      const stmt = sqlDb.prepare(sql);
      stmt.bind(args);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
    async run(sql, args) {
      sqlDb.run(sql, args);
      const changes = sqlDb.getRowsModified();
      const idRes   = sqlDb.exec('SELECT last_insert_rowid()');
      const lastInsertRowid = idRes[0]?.values[0][0] ?? null;
      saveDb();
      return { lastInsertRowid, changes };
    },
    async exec(sql) { sqlDb.exec(sql); saveDb(); },
  };

  for (const table of TABLES_SQLITE) sqlDb.exec(table);

  // Migrations SQLite — colonnes ajoutées après création initiale
  const migrationsSQLite = [
    `ALTER TABLE contributions ADD COLUMN statut_paiement TEXT NOT NULL DEFAULT 'en_attente'`,
    `ALTER TABLE contributions ADD COLUMN reference TEXT`,
  ];
  for (const m of migrationsSQLite) { try { sqlDb.run(m); saveDb(); } catch {} }

  const adminRes = sqlDb.exec("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!adminRes[0]?.values?.length) {
    const hash = bcrypt.hashSync('Admin@FK2024!', 12);
    sqlDb.run(
      "INSERT INTO users (nom, prenom, email, password_hash, role) VALUES (?,?,?,?,'admin')",
      ['Admin', 'FaidaKomori', 'admin@faidakomori.km', hash]
    );
    saveDb();
    console.log('[DB] Compte admin créé → admin@faidakomori.km / Admin@FK2024!');
  }
}

/* ── Point d'entrée ───────────────────────────────────────── */
db.init = async function () {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    await initPostgres(dbUrl);
  } else {
    console.log('[DB] DATABASE_URL non défini → base locale sql.js');
    await initSqlJsLocal();
  }
};

module.exports = db;
