#!/usr/bin/env node
/*
  Diagnostic script: Inspect notifications table and validate payload_json contents.
  - Parses payload_json for each notification
  - For appointment notifications, checks that the referenced appointment exists
  - Verifies referenced user and therapist where possible
  - Validates starts_at timestamp

  Usage (from server folder):
    node src/scripts/check_notifications.js

  This script uses the same SQLite file configured by the server: data/medicare.db
*/
import Database from 'better-sqlite3';

function safeParse(str) {
  if (!str) return [null, 'empty'];
  try {
    return [JSON.parse(str), null];
  } catch (e) {
    return [null, e.message || String(e)];
  }
}

function isIsoDateString(s) {
  if (!s || typeof s !== 'string') return false;
  const t = Date.parse(s);
  return !Number.isNaN(t);
}

function inspect() {
  const db = new Database('data/medicare.db', { readonly: true });

  const rows = db.prepare('SELECT id, therapist_id, type, payload_json, is_read, created_at FROM notifications ORDER BY created_at DESC LIMIT 500').all();
  console.log(`Found ${rows.length} notifications (most recent first)`);

  for (const r of rows) {
    console.log('---');
    console.log(`id=${r.id} therapist_id=${r.therapist_id} type=${r.type} is_read=${r.is_read} created_at=${r.created_at}`);
    const [payload, err] = safeParse(r.payload_json);
    if (err) {
      console.warn('  payload_json parse error ->', err);
      console.log('  raw payload_json ->', String(r.payload_json).slice(0, 400));
      continue;
    }
    console.log('  payload keys:', Object.keys(payload || {}).join(', ') || '[empty]');

    // appointment specific checks
    if ((r.type === 'appointment') || (payload && payload.kind === 'appointment')) {
      const apptId = payload?.appointment_id || payload?.appointmentId || null;
      if (!apptId) {
        console.warn('  appointment notification missing appointment_id in payload');
      } else {
        const appt = db.prepare('SELECT id, user_id, therapist_id, starts_at, status FROM appointments WHERE id=?').get(apptId);
        if (!appt) {
          console.error(`  appointment_id=${apptId} referenced in payload but not found in appointments table`);
        } else {
          console.log(`  appointment exists id=${appt.id} user_id=${appt.user_id} therapist_id=${appt.therapist_id} starts_at=${appt.starts_at} status=${appt.status}`);
          if (String(appt.therapist_id) !== String(r.therapist_id)) {
            console.warn(`  mismatch: notification.therapist_id=${r.therapist_id} vs appointment.therapist_id=${appt.therapist_id}`);
          }
        }
      }

      // user check
      if (payload?.user_id) {
        const user = db.prepare('SELECT id, name, email FROM users WHERE id=?').get(payload.user_id);
        if (!user) {
          console.error(`  payload.user_id=${payload.user_id} not found in users table`);
        } else {
          console.log(`  referenced user: id=${user.id} name=${user.name} email=${user.email}`);
          if (payload.patient_name && payload.patient_name !== user.name) {
            console.warn(`  patient_name mismatch: payload.patient_name='${payload.patient_name}' vs users.name='${user.name}'`);
          }
        }
      }

      // starts_at validation
      if (payload?.starts_at) {
        if (!isIsoDateString(payload.starts_at)) {
          console.warn(`  starts_at appears invalid: '${payload.starts_at}'`);
        } else {
          console.log(`  starts_at looks valid: ${payload.starts_at}`);
        }
      }

      if (payload?.call_type) console.log(`  call_type: ${payload.call_type}`);
    }

    // message notification quick checks
    if ((r.type === 'message') || (payload && payload.kind === 'message')) {
      if (!payload?.message_id) console.warn('  message notification missing message_id');
      if (!payload?.user_id) console.warn('  message notification missing user_id');
    }
  }

  db.close();
}

try {
  inspect();
} catch (e) {
  console.error('Failed to inspect notifications:', e);
  process.exitCode = 2;
}
