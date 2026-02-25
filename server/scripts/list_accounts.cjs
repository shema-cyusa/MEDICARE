const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'medicare.db');
const db = new Database(dbPath, { readonly: true });

console.log('Therapists:');
const therapists = db.prepare('SELECT id, name, email FROM therapists').all();
therapists.forEach(t => console.log(`  id=${t.id}  email=${t.email}  name=${t.name}`));

console.log('\nUsers:');
const users = db.prepare('SELECT id, name, email FROM users').all();
users.forEach(u => console.log(`  id=${u.id}  email=${u.email}  name=${u.name}`));

process.exit(0);
