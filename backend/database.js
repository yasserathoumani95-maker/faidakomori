/* ============================================================
   FaidaKomori — database.js
   Base de données SQLite réelle via better-sqlite3
   Remplace le faux parseur JSON (plus de bugs de SQL custom)
   ============================================================ */

const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const fs       = require('fs');

const DB_DIR  = path.join(__dirname, 'db');
const DB_PATH = path.join(DB_DIR, 'faidakomori.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Performance & intégrité référentielle
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Création des tables ───────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    nom                  TEXT    NOT NULL,
    prenom               TEXT    NOT NULL,
    email                TEXT    UNIQUE NOT NULL,
    password_hash        TEXT    NOT NULL,
    role                 TEXT    NOT NULL DEFAULT 'user',
    tel                  TEXT,
    ile                  TEXT,
    paiement_tel         TEXT,
    paiement_banque      TEXT,
    paiement_rib         TEXT,
    reset_token          TEXT,
    reset_token_expires  TEXT,
    created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT
  );

  CREATE TABLE IF NOT EXISTS projects (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER,
    type              TEXT    NOT NULL,
    nom_projet        TEXT    NOT NULL,
    description       TEXT,
    secteur           TEXT,
    montant           INTEGER DEFAULT 0,
    duree             INTEGER DEFAULT 30,
    montant_collecte  INTEGER DEFAULT 0,
    nb_contributeurs  INTEGER DEFAULT 0,
    status            TEXT    NOT NULL DEFAULT 'new',
    note_admin        TEXT,
    image_url         TEXT,
    budget_lien       TEXT,
    budget_description TEXT,
    contrepartie      TEXT,
    parts_pourcentage REAL,
    valeur_entreprise INTEGER,
    impact            TEXT,
    entreprise        TEXT,
    ile               TEXT,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS contributions (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id           INTEGER NOT NULL,
    user_id              INTEGER,
    nom_contributeur     TEXT,
    montant              INTEGER NOT NULL,
    methode_paiement     TEXT    DEFAULT 'mvola',
    message              TEXT,
    anonyme              INTEGER DEFAULT 0,
    coordonnees_paiement TEXT,
    livraison_status     TEXT,
    parts_pourcentage    REAL,
    created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (user_id)    REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    message    TEXT    NOT NULL,
    lien       TEXT,
    lu         INTEGER DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS newsletter (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT    UNIQUE NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS versements (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL,
    user_id         INTEGER NOT NULL,
    montant_demande INTEGER NOT NULL,
    montant_verse   INTEGER,
    motif           TEXT,
    status          TEXT    NOT NULL DEFAULT 'pending',
    note_admin      TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (user_id)    REFERENCES users(id)
  );
`);

// ── Compte admin par défaut (créé une seule fois) ─────────────
const adminExists = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).get();
if (!adminExists) {
  const hash = bcrypt.hashSync('Admin@FK2024!', 12);
  db.prepare(`
    INSERT INTO users (nom, prenom, email, password_hash, role)
    VALUES ('Admin', 'FaidaKomori', 'admin@faidakomori.km', ?, 'admin')
  `).run(hash);
  console.log('[DB] ✅ Compte admin créé → admin@faidakomori.km / Admin@FK2024!');
} else {
  console.log('[DB] ✅ Base SQLite connectée →', DB_PATH);
}

module.exports = db;
