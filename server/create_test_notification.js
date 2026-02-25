// Quick test to create a lab result notification
import Database from 'better-sqlite3';

const db = new Database('./data/medicare.db');

console.log('=== Creating Test Lab Result Notification ===\n');

// Get all assignments
const assignments = db.prepare('SELECT * FROM lab_assignments LIMIT 5').all();
console.log('Available assignments:', assignments.length);
assignments.forEach(a => {
  console.log(`  - ID ${a.id}: therapist=${a.therapist_id}, status=${a.status}`);
});

if (assignments.length > 0) {
  const assignment = assignments[0];
  console.log(`\nUsing assignment ${assignment.id} for test`);
  
  // Create a lab result
  const result = db.prepare(`
    INSERT INTO lab_results (assignment_id, result_json, uploaded_by) 
    VALUES (?, ?, ?)
  `).run(assignment.id, 'Test results: All values normal', 'test_script');
  
  console.log('✅ Lab result created with ID:', result.lastInsertRowid);
  
  // Create notification for therapist
  const notifPayload = {
    kind: 'lab_result',
    assignment_id: assignment.id,
    assignment: assignment
  };
  
  const notif = db.prepare(`
    INSERT INTO notifications (therapist_id, type, payload_json, created_at) 
    VALUES (?, ?, ?, datetime('now'))
  `).run(assignment.therapist_id, 'lab_result', JSON.stringify(notifPayload));
  
  console.log('✅ Notification created with ID:', notif.lastInsertRowid);
  console.log('✅ Therapist ID:', assignment.therapist_id);
  
  console.log('\n🔔 Notification should appear in therapist dashboard now!');
  console.log('   Refresh the page to see it.');
} else {
  console.log('❌ No assignments found in database');
  console.log('   First create an assignment from the app');
}

db.close();
