import Database from 'better-sqlite3';
import crypto from 'crypto';

const db = new Database('data/medicare.db');

// Helper for password hashing
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

// Check if therapists exist
const count = db.prepare('SELECT COUNT(*) as c FROM therapists').get().c;
console.log(`Found ${count} therapists in database`);

if (count === 0) {
  console.log('Seeding sample therapists...');
  const { salt: salt1, hash: hash1 } = hashPassword('password123');
  const { salt: salt2, hash: hash2 } = hashPassword('password123');

  db.prepare(`
    INSERT INTO therapists (name, email, password_hash, password_salt, specialization, bio)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('Diana', 'diana@example.com', hash1, salt1, 'CBT', 'Specialist in cognitive behavioral therapy');

  db.prepare(`
    INSERT INTO therapists (name, email, password_hash, password_salt, specialization, bio)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('Nema', 'nema@example.com', hash2, salt2, 'Family Therapy', 'Specialist in family and couples therapy');

  console.log('✓ Therapists seeded successfully');
  
  // Verify
  const therapists = db.prepare('SELECT id, name, email, specialization FROM therapists').all();
  console.log('Therapists in database:');
  therapists.forEach(t => console.log(`  - ${t.name} (${t.email}) [${t.specialization}]`));
} else {
  console.log('✓ Database already has therapists. No seeding needed.');
}

db.close();
