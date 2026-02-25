import Database from 'better-sqlite3';

const db = new Database('data/medicare.db');

try {
  console.log('Checking for user: mutesi@therapist.com\n');
  
  const therapist = db.prepare('SELECT id, name, email, password_hash, password_salt FROM therapists WHERE email=?').get('mutesi@therapist.com');
  if (therapist) {
    console.log('Found therapist:');
    console.log('  ID:', therapist.id);
    console.log('  Name:', therapist.name);
    console.log('  Email:', therapist.email);
    console.log('  Has password hash:', !!therapist.password_hash);
  } else {
    console.log('Therapist not found');
  }
  
  const user = db.prepare('SELECT id, name, email, password_hash, password_salt FROM users WHERE email=?').get('mutesi@therapist.com');
  if (user) {
    console.log('Found user:');
    console.log('  ID:', user.id);
    console.log('  Name:', user.name);
    console.log('  Email:', user.email);
    console.log('  Has password hash:', !!user.password_hash);
  } else {
    console.log('User not found');
  }
  
  console.log('\n--- All therapists ---');
  const allTherapists = db.prepare('SELECT id, name, email FROM therapists').all();
  allTherapists.forEach(t => console.log(`  ${t.id}: ${t.name} (${t.email})`));
  
} catch (e) {
  console.error('Error:', e.message);
} finally {
  db.close();
}
