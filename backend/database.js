/* ============================================================
   FaidaKomori — database.js
   Base de données SQLite via sql.js (pure JavaScript, zero compilation)
   Meme API que better-sqlite3 : .prepare().get / .all / .run
   ============================================================ */

const initSqlJs = require('sql.js');
const bcrypt    = require('bcryptjs');
const path      = require('path');
const fs        = require('fs');

const DB_DIR  = path.join(__dirname, 'db');
const DB_PATH = path.join(DB_DIR, 'faidakomori.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let sqlDb = null;

function saveDb() {
  if (!sqlDb) return;
  try {
    const data = sqlDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('[DB] Erreur sauvegarde:', e.message);
  }
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
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
  );
  CREATE TABLE IF NOT EXISTS projects (
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
  );
  CREATE TABLE IF NOT EXISTS contributions (
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
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    lien TEXT,
    lu INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS newsletter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS versements (
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
  );
`;

const db = {
  prepare(sql) {
    return {
      get(...args) {
        if (!sqlDb) throw new Error('DB non initialisee');
        const stmt = sqlDb.prepare(sql);
        stmt.bind(args);
        const row = stmt.step() ? stmt.getAsObject() : undefined;
        stmt.free();
        return row;
      },
      all(...args) {
        if (!sqlDb) throw new Error('DB non initialisee');
        const stmt = sqlDb.prepare(sql);
        stmt.bind(args);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },
      run(...args) {
        if (!sqlDb) throw new Error('DB non initialisee');
        sqlDb.run(sql, args);
        const changes = sqlDb.getRowsModified();
        const idRes   = sqlDb.exec('SELECT last_insert_rowid()');
        const lastInsertRowid = idRes[0]?.values[0][0] ?? null;
        saveDb();
        return { lastInsertRowid, changes };
      }
    };
  },
  exec(sql) {
    if (sqlDb) { sqlDb.exec(sql); saveDb(); }
  },
  pragma() {}
};

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(buffer);
    console.log('[DB] Base SQLite chargee ->', DB_PATH);
  } else {
    sqlDb = new SQL.Database();
    console.log('[DB] Nouvelle base SQLite creee ->', DB_PATH);
  }
  sqlDb.exec(SCHEMA);
  const adminRes = sqlDb.exec("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!adminRes[0]?.values?.length) {
    const hash = bcrypt.hashSync('Admin@FK2024!', 12);
    sqlDb.run(
      "INSERT INTO users (nom, prenom, email, password_hash, role) VALUES (?, ?, ?, ?, 'admin')",
      ['Admin', 'FaidaKomori', 'admin@faidakomori.km', hash]
    );
    console.log('[DB] Compte admin cree -> admin@faidakomori.km / Admin@FK2024!');
  }
  saveDb();
}

db.init = initDb;
module.exports = db;
