import Database from 'better-sqlite3';
import crypto from 'crypto';

const db = new Database('data/medicare.db');

function verifyPassword(password, salt, hash) {
  const hashed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashed, 'hex'));
}

try {
  const user = db.prepare('SELECT id, name, email, password_hash, password_salt FROM users WHERE email=?').get('mutesi@therapist.com');
  
  if (user) {
    console.log('User found:', user.name);
    console.log('Password hash exists:', !!user.password_hash);
    console.log('Password salt exists:', !!user.password_salt);
    
    const password = 'NewPass123!';
    const isValid = verifyPassword(password, user.password_salt, user.password_hash);
    console.log(`\nPassword "${password}" is valid:`, isValid);
  } else {
    console.log('User not found');
  }
} catch (e) {
  console.error('Error:', e.message);
} finally {
  db.close();
}
