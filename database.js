const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'crm_database.db');

let db = null;
let initialized = false;

async function getDatabase() {
  if (initialized && db) return db;
  if (initialized && !db) throw new Error('Database initialization failed previously');

  try {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    db.run('PRAGMA foreign_keys = ON');
    createTables();
    seedDefaultAdmin();
    initialized = true;
    console.log('✓ Base de datos inicializada correctamente');
    return db;
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
}

function saveDatabase() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

function createTables() {
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, full_name TEXT NOT NULL, role TEXT DEFAULT \'user\', avatar TEXT DEFAULT NULL, active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, company_name TEXT NOT NULL, contact_name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, city TEXT, country TEXT DEFAULT \'Perú\', tax_id TEXT, notes TEXT, status TEXT DEFAULT \'active\', created_by INTEGER REFERENCES users(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL, status TEXT DEFAULT \'planning\', priority TEXT DEFAULT \'medium\', start_date DATE, end_date DATE, budget REAL DEFAULT 0, created_by INTEGER REFERENCES users(id), assigned_to INTEGER REFERENCES users(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE, assigned_to INTEGER REFERENCES users(id), status TEXT DEFAULT \'pending\', priority TEXT DEFAULT \'medium\', due_date DATE, created_by INTEGER REFERENCES users(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id), action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id INTEGER, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
}

function seedDefaultAdmin() {
  const result = db.exec("SELECT COUNT(*) as cnt FROM users");
  let count = 0;
  if (result && result.length > 0 && result[0].values && result[0].values.length > 0) {
    count = result[0].values[0][0];
  }

  if (count === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.run('INSERT INTO users (username, email, password, full_name, role) VALUES (?, ?, ?, ?, ?)', ['admin', 'admin@crm.com', hashedPassword, 'Administrador', 'admin']);
    saveDatabase();
    console.log('✓ Usuario admin creado (admin@crm.com / admin123)');
  }
}

function queryAll(sql, params) {
  if (!db) throw new Error('Database not initialized');
  try {
    const stmt = db.prepare(sql);
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

function queryOne(sql, params) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params) {
  if (!db) throw new Error('Database not initialized');
  try {
    db.run(sql, params);
    saveDatabase();
    const changes = db.getRowsModified();
    const idResult = db.exec('SELECT last_insert_rowid() as id');
    const lastInsertRowid = idResult && idResult[0] && idResult[0].values ? idResult[0].values[0][0] : null;
    return { changes, lastInsertRowid };
  } catch (err) {
    console.error('SQL Error in run:', sql, params, err);
    throw err;
  }
}

module.exports = getDatabase;
module.exports.queryAll = queryAll;
module.exports.queryOne = queryOne;
module.exports.run = run;
