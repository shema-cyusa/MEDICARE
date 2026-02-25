import Database from 'better-sqlite3';

console.log('=== Checking medicare.db ===\n');
const db = new Database('./data/medicare.db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log(`Found ${tables.length} tables:\n`);
tables.forEach(t => console.log(`- ${t.name}`));

// Check for lab_assignments
const labAssign = tables.find(t => t.name === 'lab_assignments');
if (labAssign) {
  console.log('\n✅ lab_assignments table exists');
  const count = db.prepare('SELECT COUNT(*) as cnt FROM lab_assignments').get();
  console.log(`   Rows: ${count.cnt}`);
}

db.close();
