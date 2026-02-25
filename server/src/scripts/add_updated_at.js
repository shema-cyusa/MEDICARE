import Database from 'better-sqlite3';
const db = new Database('data/medicare.db');
try {
  console.log('[migrate] ensuring appointments.updated_at column exists');
  const cols = db.prepare("PRAGMA table_info(appointments)").all().map(c => c.name);
  if (!cols.includes('updated_at')) {
    // Ensure created_at exists so we can populate updated_at from it
    if (!cols.includes('created_at')) {
      try {
        db.exec("ALTER TABLE appointments ADD COLUMN created_at TEXT;");
        // set created_at to now for existing rows
        db.exec("UPDATE appointments SET created_at = datetime('now') WHERE created_at IS NULL;");
        console.log('[migrate] added appointments.created_at');
      } catch (e) {
        console.error('[migrate] failed to add appointments.created_at', e);
      }
    }
    db.exec("ALTER TABLE appointments ADD COLUMN updated_at TEXT;");
    db.exec("UPDATE appointments SET updated_at = COALESCE(created_at, datetime('now')) WHERE updated_at IS NULL;");
    console.log('[migrate] added appointments.updated_at');
  } else {
    console.log('[migrate] appointments.updated_at already present');
  }
} catch (e) {
  console.error('[migrate] failed to add updated_at', e);
  process.exitCode = 2;
} finally {
  db.close();
}
