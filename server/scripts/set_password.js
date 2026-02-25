const Database = require('better-sqlite3');
const crypto = require('crypto');
const db = new Database('data/medicare.db');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node set_password.js <therapist|user> <email> [newPassword]');
  process.exit(1);
}
const type = args[0];
const email = args[1];
const newPassword = args[2] || 'Password123!';

if (!['therapist','user'].includes(type)) {
  console.error('First arg must be therapist or user');
  process.exit(1);
}

const table = type === 'therapist' ? 'therapists' : 'users';
const row = db.prepare(`SELECT id FROM ${table} WHERE email = ?`).get(email);
if (!row) {
  console.error('No such user with email', email);
  process.exit(1);
}

const { salt, hash } = hashPassword(newPassword);
const stmt = db.prepare(`UPDATE ${table} SET password_hash = ?, password_salt = ? WHERE id = ?`);
stmt.run(hash, salt, row.id);
console.log(`Updated ${type} (${email}) password to '${newPassword}' (id=${row.id})`);
process.exit(0);
