import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB_PATH lets tests (verify_billing.js) use a throwaway database
// instead of the real billing.db.
const dbPath = process.env.DB_PATH || path.join(__dirname, 'billing.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to the database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Enable Foreign Keys immediately
db.run('PRAGMA foreign_keys = ON;');

// Helper to run query and return Promise
export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize schema
export const initDb = async () => {
  // Double-ensure foreign keys
  await run('PRAGMA foreign_keys = ON;');

  // Create Companies table
  await run(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      address TEXT,
      contact_person TEXT,
      mobile_number TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create Company Rates table
  await run(`
    CREATE TABLE IF NOT EXISTS company_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER UNIQUE,
      regular_tiffin_rate REAL DEFAULT 0.0,
      dahi_tiffin_rate REAL DEFAULT 0.0,
      nasta_rate REAL DEFAULT 0.0,
      tea_rate REAL DEFAULT 0.0,
      milk_rate REAL DEFAULT 0.0,
      chapati_rate REAL DEFAULT 0.0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );
  `);

  // Create Tiffin Entries table
  await run(`
    CREATE TABLE IF NOT EXISTS tiffin_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      entry_date TEXT NOT NULL, -- YYYY-MM-DD
      requisition_no TEXT NOT NULL,
      regular_tiffin_count INTEGER DEFAULT 0,
      dahi_tiffin_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      UNIQUE(company_id, entry_date, requisition_no)
    );
  `);

  // Create Refreshment Entries table
  await run(`
    CREATE TABLE IF NOT EXISTS refreshment_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      entry_date TEXT NOT NULL, -- YYYY-MM-DD
      requisition_no TEXT NOT NULL,
      nasta_count INTEGER DEFAULT 0,
      tea_count INTEGER DEFAULT 0,
      milk_litres REAL DEFAULT 0.0, -- Supports decimal
      chapati_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      UNIQUE(company_id, entry_date, requisition_no)
    );
  `);
};

export default db;
