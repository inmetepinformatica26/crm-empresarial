const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Si DATABASE_URL está configurado (Render), usa PostgreSQL.
// En caso contrario (desarrollo local), usa SQLite (sql.js).
const USE_POSTGRES = !!process.env.DATABASE_URL;

// Guarda de seguridad: en Render el filesystem es EFÍMERO.
// Si la app se despliega en Render sin DATABASE_URL, NO debe arrancar en
// SQLite porque todos los datos se perderían en cada deploy/restart.
if (process.env.RENDER && !process.env.DATABASE_URL) {
  throw new Error(
    'Render detectado sin DATABASE_URL: no se puede iniciar en SQLite (filesystem efímero). ' +
    'Conecta un servicio de PostgreSQL administrado en Render y define la variable DATABASE_URL.'
  );
}

const DB_PATH = path.join(__dirname, 'crm_database.db');

let pgPool = null;
let sqlDb = null;
let initialized = false;

// Convierte placeholders ? a $1, $2, ... (sintaxis de PostgreSQL)
function convertSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + (++i));
}

// Los COUNT(*) en PostgreSQL llegan como string (bigint); normalizamos a número
function normalizeRow(row) {
  if (!row) return null;
  if (typeof row.count !== 'undefined' && row.count !== null) {
    row.count = Number(row.count);
  }
  return row;
}

async function getDatabase() {
  if (initialized && (USE_POSTGRES ? pgPool : sqlDb)) return USE_POSTGRES ? pgPool : sqlDb;
  if (initialized && !(USE_POSTGRES ? pgPool : sqlDb)) throw new Error('Database initialization failed previously');

  try {
    if (USE_POSTGRES) {
      const { Pool } = require('pg');
      pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      await pgPool.query('SELECT 1');
      await createTables();
      await seedDefaultAdmin();
      initialized = true;
      console.log('✓ Base de datos PostgreSQL inicializada correctamente');
      return pgPool;
    } else {
      const initSqlJs = require('sql.js');
      const SQL = await initSqlJs();
      if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        sqlDb = new SQL.Database(buffer);
      } else {
        sqlDb = new SQL.Database();
      }
      sqlDb.run('PRAGMA foreign_keys = ON');
      createTables();
      seedDefaultAdmin();
      initialized = true;
      console.log('✓ Base de datos SQLite inicializada correctamente');
      return sqlDb;
    }
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
}

function saveDatabase() {
  if (USE_POSTGRES || !sqlDb) return;
  try {
    const data = sqlDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

async function createTables() {
  if (USE_POSTGRES) {
    await pgPool.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      avatar TEXT DEFAULT NULL,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await pgPool.query(`CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      company_name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      country TEXT DEFAULT 'Perú',
      tax_id TEXT,
      notes TEXT,
      status TEXT DEFAULT 'active',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await pgPool.query(`CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'planning',
      priority TEXT DEFAULT 'medium',
      start_date DATE,
      end_date DATE,
      budget REAL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      assigned_to INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await pgPool.query(`CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      assigned_to INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      due_date DATE,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await pgPool.query(`CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await pgPool.query(`CREATE TABLE IF NOT EXISTS settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
  } else {
    sqlDb.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, full_name TEXT NOT NULL, role TEXT DEFAULT \'user\', avatar TEXT DEFAULT NULL, active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    sqlDb.run('CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, company_name TEXT NOT NULL, contact_name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, city TEXT, country TEXT DEFAULT \'Perú\', tax_id TEXT, notes TEXT, status TEXT DEFAULT \'active\', created_by INTEGER REFERENCES users(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    sqlDb.run('CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL, status TEXT DEFAULT \'planning\', priority TEXT DEFAULT \'medium\', start_date DATE, end_date DATE, budget REAL DEFAULT 0, created_by INTEGER REFERENCES users(id), assigned_to INTEGER REFERENCES users(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    sqlDb.run('CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE, assigned_to INTEGER REFERENCES users(id), status TEXT DEFAULT \'pending\', priority TEXT DEFAULT \'medium\', due_date DATE, created_by INTEGER REFERENCES users(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    sqlDb.run('CREATE TABLE IF NOT EXISTS activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id), action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id INTEGER, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    sqlDb.run('CREATE TABLE IF NOT EXISTS settings (setting_key TEXT PRIMARY KEY, setting_value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  }
}

async function seedDefaultAdmin() {
  const rows = await queryAll('SELECT COUNT(*) as count FROM users');
  const count = rows.length > 0 ? rows[0].count : 0;

  if (count === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await run(
      'INSERT INTO users (username, email, password, full_name, role) VALUES (?,?,?,?,?)',
      ['admin', 'admin@crm.com', hashedPassword, 'Administrador', 'admin']
    );
    console.log('✓ Usuario admin creado (admin@crm.com / admin123)');
  }
}

// Cache de tablas que tienen columna id (para RETURNING id en INSERTs)
const tablesWithIdCache = {};
async function tableHasId(table) {
  if (table in tablesWithIdCache) return tablesWithIdCache[table];
  try {
    const res = await pgPool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = 'id'",
      [table]
    );
    tablesWithIdCache[table] = res.rows.length > 0;
  } catch (err) {
    tablesWithIdCache[table] = true; // ante error, mantener comportamiento original
  }
  return tablesWithIdCache[table];
}

async function queryAll(sql, params) {
  if (!USE_POSTGRES) {
    if (!sqlDb) throw new Error('Database not initialized');
    try {
      const stmt = sqlDb.prepare(sql);
      if (params && params.length > 0) stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } catch (err) {
      console.error('SQL Error in queryAll:', sql, params, err);
      throw err;
    }
  }

  if (!pgPool) throw new Error('Database not initialized');
  try {
    const result = await pgPool.query(convertSql(sql), params || []);
    return (result.rows || []).map(normalizeRow);
  } catch (err) {
    console.error('SQL Error in queryAll:', sql, params, err);
    throw err;
  }
}

async function queryOne(sql, params) {
  const rows = await queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function run(sql, params) {
  if (!USE_POSTGRES) {
    if (!sqlDb) throw new Error('Database not initialized');
    try {
      sqlDb.run(sql, params);
      saveDatabase();
      const changes = sqlDb.getRowsModified();
      const idResult = sqlDb.exec('SELECT last_insert_rowid() as id');
      const lastInsertRowid = idResult && idResult[0] && idResult[0].values ? idResult[0].values[0][0] : null;
      return { changes, lastInsertRowid };
    } catch (err) {
      console.error('SQL Error in run:', sql, params, err);
      throw err;
    }
  }

  if (!pgPool) throw new Error('Database not initialized');
  try {
    let sqlToRun = convertSql(sql);
    if (/^INSERT/i.test(sql.trim()) && !/RETURNING/i.test(sqlToRun)) {
      const tableMatch = sqlToRun.match(/INSERT INTO\s+([a-z_0-9]+)/i);
      if (tableMatch && await tableHasId(tableMatch[1])) {
        sqlToRun += ' RETURNING id';
      }
    }
    const result = await pgPool.query(sqlToRun, params || []);
    const lastInsertRowid = result.rows && result.rows.length > 0 ? result.rows[0].id : null;
    return { changes: result.rowCount || 0, lastInsertRowid };
  } catch (err) {
    console.error('SQL Error in run:', sql, params, err);
    throw err;
  }
}

module.exports = getDatabase;
module.exports.queryAll = queryAll;
module.exports.queryOne = queryOne;
module.exports.run = run;
module.exports.USE_POSTGRES = USE_POSTGRES;

