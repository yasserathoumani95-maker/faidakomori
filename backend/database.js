/* ============================================================
   FaidaKomori — database.js  v2
   Base de données JSON — parseur SQL robuste (littéraux + ?)
   ============================================================ */

const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');

const DB_DIR  = path.join(__dirname, 'db');
const DB_PATH = path.join(DB_DIR, 'faidakomori.json');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const EMPTY = {
  users:[], projects:[], contributions:[],
  newsletter:[], notifications:[], versements:[], _counters:{}
};

function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return JSON.parse(JSON.stringify(EMPTY)); }
}
function writeDB(d) { fs.writeFileSync(DB_PATH, JSON.stringify(d, null, 2)); }
function nextId(db, t) { db._counters[t] = (db._counters[t]||0)+1; return db._counters[t]; }

/* ── Parse les valeurs VALUES (mix ? et 'literals') ──────── */
function parseValues(sql, args) {
  const m = sql.match(/VALUES\s*\(([^)]+)\)/i);
  if (!m) return {};
  const cols  = (sql.match(/\(([^)]+)\)\s+VALUES/i)||[])[1]?.split(',').map(s=>s.trim().replace(/[`"]/g,'')) || [];
  const valTokens = m[1].split(',').map(s=>s.trim());
  let argIdx = 0;
  const row = {};
  cols.forEach((col, i) => {
    const tok = valTokens[i] || '?';
    if (tok === '?') {
      row[col] = args[argIdx++] ?? null;
    } else if (/^'.*'$/.test(tok)) {
      row[col] = tok.slice(1,-1);
    } else if (!isNaN(tok)) {
      row[col] = parseFloat(tok);
    } else if (tok === 'NULL') {
      row[col] = null;
    } else if (tok.toUpperCase() === 'CURRENT_TIMESTAMP') {
      row[col] = new Date().toISOString();
    } else {
      row[col] = args[argIdx++] ?? null;
    }
  });
  return { row, argIdx };
}

/* ── Parse WHERE clause → filtre de rows ─────────────────── */
function filterRows(rows, sql, args) {
  if (!rows || !rows.length) return [];
  const whereM = sql.match(/WHERE\s+([\s\S]+?)(?:\s+ORDER|\s+LIMIT|\s+GROUP\s+BY|$)/i);
  if (!whereM) return [...rows];

  const clause = whereM[1].trim();

  // Décompose en conditions AND
  const conditions = clause.split(/\bAND\b/i).map(s=>s.trim());

  // Pré-calculer les valeurs pour les ? dans l'ordre
  const qMarks = (clause.match(/\?/g)||[]).length;
  let argIdx = 0;

  // Mapper chaque condition à une valeur concrète
  const parsed = conditions.map(cond => {
    const hasQ = cond.includes('?');
    const val  = hasQ ? (args[argIdx++] ?? null) : null;
    return { cond, val, hasQ };
  });

  return rows.filter(row => {
    return parsed.every(({ cond, val }) => {
      // col = ?  ou  col = 'literal'
      let m;
      if ((m = cond.match(/^(\w+)\s*=\s*\?$/i))) {
        return row[m[1].toLowerCase()] == val;
      }
      if ((m = cond.match(/^(\w+)\s*=\s*'([^']*)'$/i))) {
        return String(row[m[1].toLowerCase()]||'') === m[2];
      }
      if ((m = cond.match(/^(\w+)\s*!=\s*\?$/i))) {
        return row[m[1].toLowerCase()] != val;
      }
      if ((m = cond.match(/^(\w+)\s*!=\s*'([^']*)'$/i))) {
        return String(row[m[1].toLowerCase()]||'') !== m[2];
      }
      if ((m = cond.match(/^(\w+)\s+IN\s*\(([^)]+)\)/i))) {
        const vals = m[2].split(',').map(v=>v.trim().replace(/'/g,''));
        return vals.includes(String(row[m[1].toLowerCase()]||''));
      }
      if ((m = cond.match(/^(\w+)\s+IS\s+NOT\s+NULL$/i))) {
        return row[m[1].toLowerCase()] !== null && row[m[1].toLowerCase()] !== undefined;
      }
      if ((m = cond.match(/^(\w+)\s+IS\s+NULL$/i))) {
        const v = row[m[1].toLowerCase()];
        return v === null || v === undefined;
      }
      return true; // condition non reconnue → ne filtre pas
    });
  });
}

/* ── Parse SET clause pour UPDATE ────────────────────────── */
function applyUpdate(sql, args, rows) {
  const setM   = sql.match(/SET\s+([\s\S]+?)\s+WHERE/i);
  const whereM = sql.match(/WHERE\s+([\s\S]+?)(?:\s+ORDER|\s+LIMIT|$)/i);
  if (!setM) return 0;

  // Extraire les colonnes à mettre à jour
  const setParts = setM[1].split(',').map(s=>s.trim());
  const setOps   = setParts.map(p => {
    const m = p.match(/(\w+)\s*=\s*(.+)/);
    if (!m) return null;
    const col = m[1].toLowerCase();
    const raw = m[2].trim();
    return { col, raw };
  }).filter(Boolean);

  // Séparer les args SET des args WHERE (inclut les ? dans les expressions arithmétiques)
  const setArgCount  = setOps.reduce((n, o) => n + (o.raw==='?' || /^\w+\s*[+\-]\s*\?/.test(o.raw) ? 1 : 0), 0);
  const setArgs      = args.slice(0, setArgCount);
  const whereArgs    = args.slice(setArgCount);

  // Construire le WHERE partiel avec les args restants
  const fakeSQL = `SELECT * FROM t WHERE ${whereM ? whereM[1] : '1=1'}`;
  const targets = filterRows(rows, fakeSQL, whereArgs);

  let setArgIdx = 0;
  let changes = 0;
  targets.forEach(row => {
    setOps.forEach(op => {
      if (op.raw === '?') {
        row[op.col] = setArgs[setArgIdx++] ?? null;
      } else if (/^'.*'$/.test(op.raw)) {
        row[op.col] = op.raw.slice(1,-1);
      } else if (op.raw.toUpperCase() === 'CURRENT_TIMESTAMP') {
        row[op.col] = new Date().toISOString();
      } else if (/^\w+\s*[+\-]\s*\?/.test(op.raw)) {
        // col = col + ?
        const addMatch = op.raw.match(/(\w+)\s*([+\-])\s*\?/);
        if (addMatch) {
          const base = parseFloat(row[addMatch[1]]) || 0;
          const delta = parseFloat(setArgs[setArgIdx++]) || 0;
          row[op.col] = addMatch[2] === '+' ? base + delta : base - delta;
        }
      } else if (/^\w+\s*[+\-]\s*\d+/.test(op.raw)) {
        // col = col + 1 (literal arithmetic)
        const addMatch = op.raw.match(/(\w+)\s*([+\-])\s*(\d+)/);
        if (addMatch) {
          const base = parseFloat(row[addMatch[1]]) || 0;
          const delta = parseFloat(addMatch[3]);
          row[op.col] = addMatch[2] === '+' ? base + delta : base - delta;
        }
      } else if (!isNaN(op.raw)) {
        row[op.col] = parseFloat(op.raw);
      } else {
        row[op.col] = null;
      }
    });
    if (!row.updated_at && row.created_at) row.updated_at = new Date().toISOString();
    changes++;
  });
  return changes;
}

/* ── API principale ──────────────────────────────────────── */
const db = {
  prepare(sql) {
    const S = sql.trim().toUpperCase();
    const table = (sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i)||[])[1]?.toLowerCase();

    return {
      run(...args) {
        const data = readDB();
        if (!table) return { lastInsertRowid:null, changes:0 };

        if (S.startsWith('INSERT')) {
          const { row } = parseValues(sql, args);
          row.id = row.id || nextId(data, table);
          if (!row.created_at) row.created_at = new Date().toISOString();
          if (!data[table]) data[table] = [];
          data[table].push(row);
          writeDB(data);
          return { lastInsertRowid: row.id, changes: 1 };
        }

        if (S.startsWith('UPDATE')) {
          if (!data[table]) return { changes:0 };
          const ch = applyUpdate(sql, args, data[table]);
          writeDB(data);
          return { changes: ch };
        }

        return { changes:0 };
      },

      get(...args) {
        const data = readDB();
        if (!table) return undefined;
        const rows = data[table] || [];

        if (S.includes('COUNT(*)')) {
          return { n: filterRows(rows, sql, args).length };
        }
        if (S.includes('SUM(') || S.includes('COALESCE(SUM')) {
          const col = (sql.match(/SUM\(([^)]+)\)/i)||[])[1]?.trim().replace(/[`"]/g,'');
          return { s: filterRows(rows, sql, args).reduce((a,r)=>a+(parseInt(r[col])||0),0) };
        }

        return filterRows(rows, sql, args)[0] ?? undefined;
      },

      all(...args) {
        const data = readDB();
        if (!table) return [];
        let rows = filterRows(data[table] || [], sql, args);

        // JOINs
        if (/JOIN users/i.test(sql)) {
          rows = rows.map(r => {
            const u = data.users.find(u=>u.id===r.user_id);
            return u ? {...r, nom:u.nom, prenom:u.prenom, email:u.email, tel:u.tel} : r;
          });
        }
        if (/JOIN projects/i.test(sql)) {
          rows = rows.map(r => {
            const p = data.projects.find(p=>p.id===r.project_id);
            return p ? {...r, nom_projet:p.nom_projet, type:p.type, project_status:p.status, image_url:p.image_url, secteur:p.secteur} : r;
          });
        }

        // ORDER BY
        if (/ORDER BY.*created_at\s+DESC/i.test(sql))
          rows.sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
        else if (/ORDER BY.*created_at/i.test(sql))
          rows.sort((a,b) => new Date(a.created_at)-new Date(b.created_at));

        // LIMIT / OFFSET
        const off = parseInt((sql.match(/OFFSET\s+(\d+)/i)||[])[1]||0);
        const lim = parseInt((sql.match(/LIMIT\s+(\d+)/i)||[])[1]||Infinity);
        return rows.slice(off, off+lim);
      }
    };
  },
  exec()   {},
  pragma() {},
};

/* ── Compte admin par défaut ─────────────────────────────── */
(function() {
  const data = readDB();
  if (!data.users.find(u=>u.role==='admin')) {
    const hash = bcrypt.hashSync('Admin@FK2024!', 12);
    data.users.push({
      id: nextId(data,'users'), nom:'Admin', prenom:'FaidaKomori',
      email:'admin@faidakomori.km', password_hash:hash,
      role:'admin', tel:null, ile:null,
      created_at: new Date().toISOString()
    });
    writeDB(data);
    console.log('[DB] ✅ Compte admin créé → admin@faidakomori.km / Admin@FK2024!');
  }
})();

module.exports = db;
module.exports.readDB  = readDB;
module.exports.writeDB = writeDB;
module.exports.nextId  = nextId;
