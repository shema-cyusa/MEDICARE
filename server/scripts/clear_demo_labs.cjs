const Database = require('better-sqlite3');
const db = new Database('data/medicare.db');
try {
  const demoNames = ['Acme Lab','Central Diagnostics','HealthPlus Labs'];
  const labs = db.prepare(`SELECT id, name FROM labs WHERE name IN (${demoNames.map(()=>'?').join(',')})`).all(...demoNames);
  if (!labs || labs.length === 0) {
    console.log('No demo labs found.');
    process.exit(0);
  }
  const ids = labs.map(l => l.id);
  console.log('Found demo lab ids:', ids.join(','));
  const placeholders = ids.map(()=>'?').join(',');
  const tx = db.transaction(() => {
    // Delete lab_results for assignments of these labs
    db.prepare(`DELETE FROM lab_results WHERE assignment_id IN (SELECT id FROM lab_assignments WHERE lab_id IN (${placeholders}))`).run(...ids);
    // Delete assignments
    db.prepare(`DELETE FROM lab_assignments WHERE lab_id IN (${placeholders})`).run(...ids);
    // Delete notifications for those labs
    db.prepare(`DELETE FROM notifications WHERE lab_id IN (${placeholders})`).run(...ids);
    // Finally delete the labs
    const info = db.prepare(`DELETE FROM labs WHERE id IN (${placeholders})`).run(...ids);
    console.log('Deleted labs count:', info.changes);
  });
  tx();
  console.log('Demo labs and related data removed successfully.');
} catch (e) {
  console.error('Failed to clear demo labs:', e);
  process.exit(1);
} finally {
  db.close();
}
