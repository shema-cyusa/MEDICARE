const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'medicare.db');
const db = new Database(dbPath);

// Add user_type column if it doesn't exist
try {
  const cols = db.prepare("PRAGMA table_info(users)").all();
  if (!cols.some(c => c.name === 'user_type')) {
    db.exec("ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'user';");
    console.log('[migration] Added user_type column to users table');
  } else {
    console.log('[migration] user_type column already exists');
  }
} catch (e) {
  console.error('[migration] error checking/adding user_type:', e);
}

// Update mutesi@therapist.com to be a therapist
try {
  const stmt = db.prepare("UPDATE users SET user_type = 'therapist' WHERE email = ?");
  const info = stmt.run('mutesi@therapist.com');
  if (info.changes > 0) {
    console.log(`[migration] Updated mutesi@therapist.com to user_type='therapist' (${info.changes} row(s))`);
  } else {
    console.log('[migration] No user found with email mutesi@therapist.com');
  }
} catch (e) {
  console.error('[migration] error updating user_type:', e);
}

console.log('[migration] Done');
db.close();
process.exit(0);
