import Database from 'better-sqlite3';
import crypto from 'crypto';

// Absolute path to the existing DB
const DB_PATH = 'c:\\Users\\educa\\Desktop\\MEDICARE\\server\\data\\medicare.db';

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

// Demo user credentials (you can change these if you wish)
const name = 'Demo User';
const email = 'demo@example.com';
const password = 'Medicare@123';

const db = new Database(DB_PATH);

// Ensure the users table exists (safe if already created by server)
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT UNIQUE,
  password_hash TEXT,
  password_salt TEXT,
  avatar_url TEXT,
  mental_status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
const { salt, hash } = hashPassword(password);

if (existing) {
  db.prepare('UPDATE users SET name=?, password_hash=?, password_salt=? WHERE id=?')
    .run(name, hash, salt, existing.id);
  console.log(JSON.stringify({ action: 'updated', id: existing.id, email, password }, null, 2));
} else {
  const info = db.prepare('INSERT INTO users (name, email, password_hash, password_salt) VALUES (?, ?, ?, ?)')
    .run(name, email, hash, salt);
  console.log(JSON.stringify({ action: 'created', id: info.lastInsertRowid, email, password }, null, 2));
}

db.close();