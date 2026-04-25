/* ============================================================
   FaidaKomori — database.js
   Double backend :
     · sql.js  (WASM, zero compilation) → développement local
     · Turso   (libSQL cloud)           → production Render
   API unifiée async : db.prepare(sql).get/all/run(...args)
   ============================================================ */

const bcrypt = require('bcryptjs');
const path   = require('path');
const fs     = require('fs');

let impl = null; // Implémentation active (sqlJs ou turso)

/* ── SCHÉMA (tables séparées pour compatibilité Turso) ────── */
const TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    tel TEXT,
    ile TEXT,
    paiement_tel TEXT,
    paiement_banque TEXT,
    paiement_rib TEXT,
    reset_token TEXT,
    reset_token_expires TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT NOT NULL,
    nom_projet TEXT NOT NULL,
    description TEXT,
    secteur TEXT,
    montant INTEGER DEFAULT 0,
    duree INTEGER DEFAULT 30,
    montant_collecte INTEGER DEFAULT 0,
    nb_contributeurs INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new',
    note_admin TEXT,
    image_url TEXT,
    budget_lien TEXT,
    budget_description TEXT,
    contrepartie TEXT,
    parts_pourcentage REAL,
    valeur_entreprise INTEGER,
    impact TEXT,
    entreprise TEXT,
    ile TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id INTEGER,
    nom_contributeur TEXT,
    montant INTEGER NOT NULL,
    methode_paiement TEXT DEFAULT 'mvola',
    message TEXT,
    anonyme INTEGER DEFAULT 0,
    coordonnees_paiement TEXT,
    livraison_status TEXT,
    parts_pourcentage REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    lien TEXT,
    lu INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS newsletter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS versements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    montant_demande INTEGER NOT NULL,
    montant_verse INTEGER,
    motif TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    note_admin TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  )`,
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
   BACKEND 1 — Turso (libSQL cloud)
   Utilisé quand TURSO_DATABASE_URL est défini (production)
══════════════════════════════════════════════════════════ */
async function initTurso(url, authToken) {
  const { createClient } = require('@libsql/client');
  const client = createClient({ url, authToken: authToken || undefined });

  impl = {
    async get(sql, args) {
      const r = await client.execute({ sql, args });
      return r.rows[0] || undefined;
    },
    async all(sql, args) {
      const r = await client.execute({ sql, args });
      return r.rows;
    },
    async run(sql, args) {
      const r = await client.execute({ sql, args });
      return {
        lastInsertRowid: r.lastInsertRowid != null ? Number(r.lastInsertRowid) : null,
        changes: r.rowsAffected,
      };
    },
    async exec(sql) {
      const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of stmts) {
        await client.execute({ sql: stmt, args: [] });
      }
    },
  };

  // Créer les tables (idempotent grâce à IF NOT EXISTS)
  for (const table of TABLES) {
    await client.execute({ sql: table, args: [] });
  }

  // Créer le compte admin si absent
  const adminRes = await client.execute({
    sql: "SELECT id FROM users WHERE role = 'admin' LIMIT 1",
    args: [],
  });
  if (!adminRes.rows.length) {
    const hash = bcrypt.hashSync('Admin@FK2024!', 12);
    await client.execute({
      sql: "INSERT INTO users (nom, prenom, email, password_hash, role) VALUES (?, ?, ?, ?, 'admin')",
      args: ['Admin', 'FaidaKomori', 'admin@faidakomori.km', hash],
    });
    console.log('[DB] Compte admin créé → admin@faidakomori.km / Admin@FK2024!');
  }

  console.log('[DB] ✅ Connecté à Turso cloud →', url.replace(/\/\/.*@/, '//***@'));
}

/* ══════════════════════════════════════════════════════════
   BACKEND 2 — sql.js (WASM SQLite local)
   Utilisé en développement (pas de TURSO_DATABASE_URL)
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
    try {
      fs.writeFileSync(DB_PATH, Buffer.from(sqlDb.export()));
    } catch (e) {
      console.error('[DB] Erreur sauvegarde:', e.message);
    }
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
    async exec(sql) {
      sqlDb.exec(sql);
      saveDb();
    },
  };

  // Schéma
  for (const table of TABLES) sqlDb.exec(table);

  // Admin
  const adminRes = sqlDb.exec("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!adminRes[0]?.values?.length) {
    const hash = bcrypt.hashSync('Admin@FK2024!', 12);
    sqlDb.run(
      "INSERT INTO users (nom, prenom, email, password_hash, role) VALUES (?, ?, ?, ?, 'admin')",
      ['Admin', 'FaidaKomori', 'admin@faidakomori.km', hash]
    );
    saveDb();
    console.log('[DB] Compte admin créé → admin@faidakomori.km / Admin@FK2024!');
  }
}

/* ── Point d'entrée ───────────────────────────────────────── */
db.init = async function () {
  const tursoUrl   = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl) {
    await initTurso(tursoUrl, tursoToken);
  } else {
    console.log('[DB] TURSO_DATABASE_URL non défini → base locale sql.js');
    await initSqlJsLocal();
  }
};

module.exports = db;
