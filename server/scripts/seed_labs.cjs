const Database = require('better-sqlite3');
const db = new Database('data/medicare.db');
try {
  const demo = [
    { name: 'Acme Lab', contact: 'acme@example.com' },
    { name: 'Central Diagnostics', contact: 'central@example.com' },
    { name: 'HealthPlus Labs', contact: 'healthplus@example.com' },
  ];
  const insert = db.prepare('INSERT INTO labs (name, contact_info) VALUES (?, ?)');
  const existing = db.prepare('SELECT name FROM labs').all().map(r => r.name);
  const tx = db.transaction(() => {
    for (const d of demo) {
      if (!existing.includes(d.name)) {
        const info = insert.run(d.name, d.contact);
        const id = info.lastInsertRowid;
        console.log('Inserted lab:', d.name, 'id=', id);
        // set default password if password columns exist
        try {
          const cols = db.prepare("PRAGMA table_info(labs)").all().map(c=>c.name);
          if (cols.includes('password_hash') && cols.includes('password_salt')) {
            const crypto = require('crypto');
            const salt = crypto.randomBytes(16).toString('hex');
            const hash = crypto.pbkdf2Sync('labpass', salt, 100000, 64, 'sha512').toString('hex');
            db.prepare('UPDATE labs SET password_hash=?, password_salt=? WHERE id=?').run(hash, salt, id);
            console.log('Set default password for lab id=', id);
          }
        } catch (e) { console.warn('Could not set lab password', e); }
      } else {
        console.log('Lab already exists:', d.name);
      }
    }
  });
  tx();
  console.log('Seeding complete');
} catch (e) {
  console.error('Failed to seed labs:', e);
} finally {
  db.close();
}
