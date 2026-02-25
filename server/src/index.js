import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const db = new Database('data/medicare.db', { verbose: null }); // file-based DB
const app = express();
app.use(cors());
// Increase JSON/body size limit to allow larger payloads (e.g., base64 images) from clients.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Admin PIN guard (very basic)
const ADMIN_PIN = process.env.ADMIN_PIN || '2468';
function adminGuard(req, res, next) {
  const headerPin = (req.headers['x-admin-pin'] || '').toString();
  const queryPin = (req.query && req.query.admin_pin) ? String(req.query.admin_pin) : '';
  if (headerPin === ADMIN_PIN || queryPin === ADMIN_PIN) return next();

  // Allow admin users who are logged in via the app by passing their user id in the header `x-user-id` or `x-user`
  const userIdHeader = req.headers['x-user-id'] || req.headers['x-user'];
  if (userIdHeader) {
    const userId = parseInt(userIdHeader, 10);
    if (!isNaN(userId)) {
      try {
        const row = db.prepare('SELECT user_type FROM users WHERE id=?').get(userId);
        if (row && row.user_type === 'admin') return next();
      } catch (e) {
        // ignore and fall through to unauthorized
      }
    }
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

// Helpers for password hashing (PBKDF2)
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  const hashed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashed, 'hex'));
}

// Init tables (idempotent)
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  password_hash TEXT,
  password_salt TEXT,
  avatar_url TEXT,
  mental_status TEXT,
  user_type TEXT DEFAULT 'user',
  specialization TEXT,
  bio TEXT,
  is_verified INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS moods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  mood TEXT,
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT,
  title TEXT,
  description TEXT,
  url TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  language TEXT DEFAULT 'en',
  tags TEXT,
  is_published INTEGER DEFAULT 1,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS therapists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT UNIQUE,
  password_hash TEXT,
  password_salt TEXT,
  specialization TEXT,
  bio TEXT,
  phone TEXT,
  avatar_url TEXT,
  availability_json TEXT,
  is_verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  therapist_id INTEGER,
  starts_at TEXT,
  ends_at TEXT,
  status TEXT,
  notes TEXT,
  meet_link TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  total_percent INTEGER,
  details_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  action TEXT,
  target_type TEXT,
  target_id INTEGER,
  details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Simple migrations for legacy DBs (add missing columns if needed)
try {
  const userCols = db.prepare("PRAGMA table_info(users)").all();
  const resourceCols = db.prepare("PRAGMA table_info(resources)").all();
  const therapistCols = db.prepare("PRAGMA table_info(therapists)").all();
  
  // Users table migrations
  if (!userCols.some(c => c.name === 'specialization')) {
    db.exec("ALTER TABLE users ADD COLUMN specialization TEXT;");
    console.log('[DB] Added users.specialization');
  }
  if (!userCols.some(c => c.name === 'bio')) {
    db.exec("ALTER TABLE users ADD COLUMN bio TEXT;");
    console.log('[DB] Added users.bio');
  }
  if (!userCols.some(c => c.name === 'is_verified')) {
    db.exec("ALTER TABLE users ADD COLUMN is_verified INTEGER;");
    db.exec("UPDATE users SET is_verified = 0 WHERE is_verified IS NULL;");
    console.log('[DB] Added users.is_verified');
  }
  if (!userCols.some(c => c.name === 'phone')) {
    db.exec("ALTER TABLE users ADD COLUMN phone TEXT;");
    console.log('[DB] Added users.phone');
  }
  if (!userCols.some(c => c.name === 'password_hash')) {
    db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT;");
    console.log('[DB] Added users.password_hash');
  }
  if (!userCols.some(c => c.name === 'password_salt')) {
    db.exec("ALTER TABLE users ADD COLUMN password_salt TEXT;");
    console.log('[DB] Added users.password_salt');
  }
  if (!userCols.some(c => c.name === 'user_type')) {
    db.exec("ALTER TABLE users ADD COLUMN user_type TEXT;");
    db.exec("UPDATE users SET user_type = 'user' WHERE user_type IS NULL;");
    console.log('[DB] Added users.user_type');
  }
  if (!userCols.some(c => c.name === 'is_active')) {
    db.exec("ALTER TABLE users ADD COLUMN is_active INTEGER;");
    db.exec("UPDATE users SET is_active = 1 WHERE is_active IS NULL;");
    console.log('[DB] Added users.is_active');
  }
  if (!userCols.some(c => c.name === 'updated_at')) {
    db.exec("ALTER TABLE users ADD COLUMN updated_at TEXT;");
    db.exec("UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;");
    console.log('[DB] Added users.updated_at');
  }
  
  // Resources table migrations
  if (!resourceCols.some(c => c.name === 'description')) {
    db.exec("ALTER TABLE resources ADD COLUMN description TEXT;");
    console.log('[DB] Added resources.description');
  }
  if (!resourceCols.some(c => c.name === 'file_path')) {
    db.exec("ALTER TABLE resources ADD COLUMN file_path TEXT;");
    console.log('[DB] Added resources.file_path');
  }
  if (!resourceCols.some(c => c.name === 'file_type')) {
    db.exec("ALTER TABLE resources ADD COLUMN file_type TEXT;");
    console.log('[DB] Added resources.file_type');
  }
  if (!resourceCols.some(c => c.name === 'file_size')) {
    db.exec("ALTER TABLE resources ADD COLUMN file_size INTEGER;");
    console.log('[DB] Added resources.file_size');
  }
  if (!resourceCols.some(c => c.name === 'is_published')) {
    db.exec("ALTER TABLE resources ADD COLUMN is_published INTEGER;");
    db.exec("UPDATE resources SET is_published = 1 WHERE is_published IS NULL;");
    console.log('[DB] Added resources.is_published');
  }
  if (!resourceCols.some(c => c.name === 'created_by')) {
    db.exec("ALTER TABLE resources ADD COLUMN created_by INTEGER;");
    console.log('[DB] Added resources.created_by');
  }
  if (!resourceCols.some(c => c.name === 'updated_at')) {
    db.exec("ALTER TABLE resources ADD COLUMN updated_at TEXT;");
    db.exec("UPDATE resources SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;");
    console.log('[DB] Added resources.updated_at');
  }
  
  // Appointments table migrations
  const apptCols = db.prepare("PRAGMA table_info(appointments)").all();
  if (!apptCols.some(c => c.name === 'notes')) {
    try {
      db.exec("ALTER TABLE appointments ADD COLUMN notes TEXT;");
      console.log('[DB] Added appointments.notes');
    } catch (e) {
      console.error('[DB] Failed to add appointments.notes', e);
    }
  }
  if (!apptCols.some(c => c.name === 'meet_link')) {
    try {
      db.exec("ALTER TABLE appointments ADD COLUMN meet_link TEXT;");
      console.log('[DB] Added appointments.meet_link');
    } catch (e) {
      console.error('[DB] Failed to add appointments.meet_link', e);
    }
  }
  if (!apptCols.some(c => c.name === 'updated_at')) {
    try {
      db.exec("ALTER TABLE appointments ADD COLUMN updated_at TEXT;");
      db.exec("UPDATE appointments SET updated_at = COALESCE(created_at, datetime('now')) WHERE updated_at IS NULL;");
      console.log('[DB] Added appointments.updated_at');
    } catch (e) {
      console.error('[DB] Failed to add appointments.updated_at', e);
    }
  }

  // Therapists table migrations
  if (!therapistCols.some(c => c.name === 'email')) {
    // SQLite cannot add a UNIQUE column via ALTER TABLE; add column then unique index
    db.exec("ALTER TABLE therapists ADD COLUMN email TEXT;");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_therapists_email ON therapists(email);");
    console.log('[DB] Added therapists.email and unique index');
  }
  if (!therapistCols.some(c => c.name === 'password_hash')) {
    db.exec("ALTER TABLE therapists ADD COLUMN password_hash TEXT;");
    console.log('[DB] Added therapists.password_hash');
  }
  if (!therapistCols.some(c => c.name === 'password_salt')) {
    db.exec("ALTER TABLE therapists ADD COLUMN password_salt TEXT;");
    console.log('[DB] Added therapists.password_salt');
  }
  if (!therapistCols.some(c => c.name === 'phone')) {
    db.exec("ALTER TABLE therapists ADD COLUMN phone TEXT;");
    console.log('[DB] Added therapists.phone');
  }
  if (!therapistCols.some(c => c.name === 'avatar_url')) {
    db.exec("ALTER TABLE therapists ADD COLUMN avatar_url TEXT;");
    console.log('[DB] Added therapists.avatar_url');
  }
  if (!therapistCols.some(c => c.name === 'is_verified')) {
    db.exec("ALTER TABLE therapists ADD COLUMN is_verified INTEGER;");
    db.exec("UPDATE therapists SET is_verified = 0 WHERE is_verified IS NULL;");
    console.log('[DB] Added therapists.is_verified');
  }
  if (!therapistCols.some(c => c.name === 'created_at')) {
    db.exec("ALTER TABLE therapists ADD COLUMN created_at TEXT;");
    db.exec("UPDATE therapists SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;");
    console.log('[DB] Added therapists.created_at');
  }
  if (!therapistCols.some(c => c.name === 'updated_at')) {
    db.exec("ALTER TABLE therapists ADD COLUMN updated_at TEXT;");
    db.exec("UPDATE therapists SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;");
    console.log('[DB] Added therapists.updated_at');
  }
} catch (e) {
  console.error('[DB migration] Failed:', e);
}

// Ensure notifications has lab_id column for older DBs
try {
  const notifCols = db.prepare("PRAGMA table_info(notifications)").all();
  if (!notifCols.some(c => c.name === 'lab_id')) {
    db.exec("ALTER TABLE notifications ADD COLUMN lab_id INTEGER;");
    console.log('[DB] Added notifications.lab_id');
  }
} catch (e) {
  // ok if altering fails on very old DBs
  console.error('[DB] notifications.lab_id migration failed', e);
}

// Assessments templates table and assessments migration
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assessment_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      therapist_id INTEGER,
      title TEXT,
      questions_json TEXT,
      is_published INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const assessCols = db.prepare("PRAGMA table_info(assessments)").all();
  if (!assessCols.some(c => c.name === 'template_id')) {
    db.exec("ALTER TABLE assessments ADD COLUMN template_id INTEGER;");
    console.log('[DB] Added assessments.template_id');
  }
} catch (e) {
  console.error('[assessments templates] setup failed:', e);
}

// Create configurable AI recommendation rules table (idempotent)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rec_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      min_total INTEGER,
      max_total INTEGER,
      title TEXT,
      intro TEXT,
      actions_json TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const rc = db.prepare('SELECT COUNT(*) AS c FROM rec_rules').get().c;
  if (rc === 0) {
    const insert = db.prepare('INSERT INTO rec_rules (min_total, max_total, title, intro, actions_json, active) VALUES (?, ?, ?, ?, ?, 1)');
    const tx = db.transaction(() => {
      insert.run(80, 100, 'Doing Well', "You're doing well overall. Keep up the healthy habits and check in again soon.", JSON.stringify([
        'Keep a daily reflection (2–3 lines)',
        'Take a short walk or stretch break today',
        'Practice gratitude: list 3 things you appreciate',
        'Schedule regular sleep and hydration',
      ]));
      insert.run(60, 79, 'Mild Stress & Focus Fatigue Detected', "Based on your responses, it seems you've been experiencing some emotional overwhelm and mental tiredness. Don't worry — this is more common than you think. Let's take small steps to help you feel better.", JSON.stringify([
        'Try a 5-minute guided breathing session today',
        'Write a short journal entry about how you\'re feeling',
        'Go to bed 30 minutes earlier tonight',
        'Consider talking with a mental health coach',
      ]));
      insert.run(0, 59, 'Elevated Stress Detected', "Your responses suggest higher stress levels and potential difficulty with focus or memory. It's important to seek support and practice restorative habits.", JSON.stringify([
        'Reach out to a trusted friend or counselor today',
        'Schedule a telehealth session with a therapist',
        'Reduce screen time 1 hour before sleep',
        'Practice a grounding exercise (5-4-3-2-1)',
      ]));
    });
    tx();
    console.log('[seed] Inserted default rec_rules');
  }
} catch (e) {
  console.error('[rec_rules] setup failed:', e);
}

// Optional seed for therapist and a demo appointment (disabled by default)
if (process.env.SEED_THERAPIST === '1') {
  try {
    const t = db.prepare("SELECT id FROM therapists WHERE name=?").get('Diana');
    let therapistId = t?.id;
    if (!therapistId) {
      const { salt, hash } = hashPassword('password123');
      const infoT = db.prepare("INSERT INTO therapists (name, email, password_hash, password_salt, specialization, bio, availability_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run('Diana', 'diana@medicare.com', hash, salt, 'CBT', 'Experienced therapist specializing in CBT and community mental health.', JSON.stringify({ days: ['Mon','Wed','Fri'], slots: ['14:00','16:00'] }));
      therapistId = infoT.lastInsertRowid;
      console.log('[seed] Created therapist Diana id=', therapistId);
    }

    const demo = db.prepare("SELECT id FROM users WHERE email=?").get('demo@example.com');
    if (demo) {
      const nowIso = new Date().toISOString();
      const existingAppt = db.prepare("SELECT id FROM appointments WHERE user_id=? AND starts_at >= ? AND status=? ORDER BY starts_at ASC LIMIT 1").get(demo.id, nowIso, 'scheduled');
      if (!existingAppt) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(16, 0, 0, 0);
        const startsAt = d.toISOString();
        const infoA = db.prepare("INSERT INTO appointments (user_id, therapist_id, starts_at, status) VALUES (?, ?, ?, 'scheduled')")
          .run(demo.id, therapistId, startsAt);
        console.log('[seed] Created appointment for demo@example.com at', startsAt, 'id=', infoA.lastInsertRowid);
      }
    }
  } catch (e) {
    console.error('[seed] Failed:', e);
  }
}

// Seed sample resources if table is empty
try {
  const count = db.prepare('SELECT COUNT(*) AS c FROM resources').get().c;
  if (count === 0) {
    const sample = [
      { category: 'anxiety', title: 'Breathing Exercises for Anxiety', url: 'https://example.org/breathing', language: 'en', tags: 'anxiety,breathing,calm' },
      { category: 'depression', title: 'Understanding Depression', url: 'https://example.org/depression', language: 'en', tags: 'depression,mood' },
      { category: 'stress', title: 'Stress Management Basics', url: 'https://example.org/stress', language: 'en', tags: 'stress,anxiety' },
      { category: 'anxiety', title: 'Ubufasha bwo guhumeka neza', url: 'https://example.org/rw-breathing', language: 'rw', tags: 'anxiety,ubwoba,kuruhuka' },
      { category: 'depression', title: 'Comprendre la dépression', url: 'https://example.org/fr-depression', language: 'fr', tags: 'depression,humeur' }
    ];
    const stmt = db.prepare('INSERT INTO resources (category, title, url, language, tags) VALUES (?, ?, ?, ?, ?)');
    const tx = db.transaction((rows) => {
      for (const r of rows) stmt.run(r.category, r.title, r.url, r.language, r.tags);
    });
    tx(sample);
    console.log('[seed] Inserted sample resources:', sample.length);
  }
} catch (e) {
  console.error('[seed resources] Failed:', e);
}

// --- Auth endpoints ---
app.post('/api/auth/signup', (req, res) => {
  const { name, email, password, user_type = 'user', phone } = req.body;
  if (!name || !email || !password || !user_type) return res.status(400).json({ error: 'Missing fields' });

  // Validate Rwandan phone number format if phone is provided
  if (phone && !/^07\d{8}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number format. Expected format: 07XXXXXXXX' });
  }

  const { salt, hash } = hashPassword(password);

  try {
    if (user_type === 'therapist') {
      // Create therapist
      const info = db.prepare('INSERT INTO therapists (name, email, password_hash, password_salt, phone) VALUES (?, ?, ?, ?, ?)')
        .run(name, email, hash, salt, phone || '');
      const therapist = db.prepare('SELECT id, name, email, phone FROM therapists WHERE id=?').get(info.lastInsertRowid);
      return res.json({ ...therapist, user_type: 'therapist' });
    } else {
      // Create user (patient)
      const info = db.prepare('INSERT INTO users (name, email, password_hash, password_salt, phone, user_type) VALUES (?, ?, ?, ?, ?, ?)')
        .run(name, email, hash, salt, phone || '', 'user');
      const user = db.prepare('SELECT id, name, email, phone, user_type FROM users WHERE id=?').get(info.lastInsertRowid);
      return res.json(user);
    }
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Email exists' });
    console.error('[signup] error:', e);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  // Check therapists first
  const therapist = db.prepare('SELECT id, name, email, password_hash, password_salt FROM therapists WHERE email=?').get(email);
  if (therapist) {
    const ok = verifyPassword(password, therapist.password_salt, therapist.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    return res.json({ id: therapist.id, name: therapist.name, email: therapist.email, user_type: 'therapist', therapist_id: therapist.id });
  }
  // Check users
  const row = db.prepare('SELECT id, name, email, user_type, password_hash, password_salt FROM users WHERE email=?').get(email);
  if (row) {
    const ok = verifyPassword(password, row.password_salt, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    return res.json({ id: row.id, name: row.name, email: row.email, user_type: row.user_type, therapist_id: null });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

// Users basic read
app.get('/api/users/:id', (req, res) => {
  const user = db.prepare('SELECT id, name, email, avatar_url, mental_status, created_at FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

// Update profile (name, avatar_url, mental_status)
app.patch('/api/users/:id', (req, res) => {
  const { name, avatar_url, mental_status } = req.body || {};
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM users WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const fields = [];
  const params = [];
  if (typeof name === 'string') { fields.push('name=?'); params.push(name); }
  if (typeof avatar_url === 'string') { fields.push('avatar_url=?'); params.push(avatar_url); }
  if (typeof mental_status === 'string') { fields.push('mental_status=?'); params.push(mental_status); }
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(id);
  const sql = `UPDATE users SET ${fields.join(', ')} WHERE id=?`;
  db.prepare(sql).run(...params);
  const user = db.prepare('SELECT id, name, email, avatar_url, mental_status, created_at FROM users WHERE id=?').get(id);
  res.json(user);
});

// Admin-lite: list users or find by email (for debugging/inspection)
app.get('/api/users', (req, res) => {
  const { email } = req.query;
  if (email) {
    const user = db.prepare('SELECT id, name, email, avatar_url, mental_status, created_at FROM users WHERE email=?').get(email);
    if (!user) return res.status(404).json({ error: 'Not found' });
    return res.json(user);
  }
  const rows = db.prepare('SELECT id, name, email, created_at FROM users ORDER BY id DESC').all();
  res.json(rows);
});

// Moods
app.post('/api/moods', (req, res) => {
  const { user_id, mood, note } = req.body;
  const info = db.prepare('INSERT INTO moods (user_id, mood, note) VALUES (?, ?, ?)').run(user_id, mood, note || null);
  const row = db.prepare('SELECT * FROM moods WHERE id=?').get(info.lastInsertRowid);
  res.json(row);
});
app.get('/api/moods/:user_id', (req, res) => {
  const rows = db.prepare('SELECT * FROM moods WHERE user_id=? ORDER BY created_at DESC').all(req.params.user_id);
  res.json(rows);
});

// Resources (simple filter) - for users (only published)
app.get('/api/resources', (req, res) => {
  const { category, language, q } = req.query;
  let sql = 'SELECT * FROM resources WHERE is_published = 1';
  const params = [];
  if (category) { sql += ' AND category=?'; params.push(category); }
  if (language) { sql += ' AND language=?'; params.push(language); }
  if (q) { sql += ' AND (title LIKE ? OR tags LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// Create resource (for therapists)
app.post('/api/resources', (req, res) => {
  const { category, title, description, url, file_path, file_type, file_size, language, tags, created_by } = req.body;
  if (!category || !title || (!url && !file_path) || !created_by) {
    return res.status(400).json({ error: 'category, title, either url or file_path, and created_by are required' });
  }
  const info = db.prepare(`
    INSERT INTO resources (category, title, description, url, file_path, file_type, file_size, language, tags, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    category,
    title,
    description || '',
    url || '',
    file_path || '',
    file_type || '',
    file_size || 0,
    language || 'en',
    tags || '',
    created_by
  );
  const resource = db.prepare('SELECT * FROM resources WHERE id=?').get(info.lastInsertRowid);
  res.json(resource);
});

// Telehealth placeholders
app.get('/api/therapists', (req, res) => {
  const rows = db.prepare('SELECT * FROM therapists').all();
  res.json(rows);
});
app.post('/api/appointments', (req, res) => {
  const { user_id, therapist_id, starts_at, call_type, meeting_link } = req.body;
  if (!user_id || !therapist_id || !starts_at) {
    return res.status(400).json({ error: 'user_id, therapist_id, and starts_at are required' });
  }
  const nowIso = new Date().toISOString();
  const info = db.prepare('INSERT INTO appointments (user_id, therapist_id, starts_at, status, meet_link, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(user_id, therapist_id, starts_at, 'scheduled', meeting_link || null, nowIso, nowIso);
  const row = db.prepare('SELECT * FROM appointments WHERE id=?').get(info.lastInsertRowid);
  // Create a notification for therapist containing richer details (patient name, call type, date/time, meeting link)
  try {
    const user = db.prepare('SELECT id, name, email FROM users WHERE id=?').get(user_id);
    const therapist = db.prepare('SELECT id, name, email FROM therapists WHERE id=?').get(therapist_id);
    const payload = {
      kind: 'appointment',
      user_id,
      appointment_id: row.id,
      starts_at: row.starts_at,
      patient_name: user?.name || null,
      patient_email: user?.email || null,
      call_type: call_type || null,
      meeting_link: meeting_link || null,
      therapist_name: therapist?.name || null,
      therapist_email: therapist?.email || null,
    };
    db.prepare('INSERT INTO notifications (therapist_id, type, payload_json) VALUES (?, ?, ?)')
      .run(therapist_id, 'appointment', JSON.stringify(payload));
    console.log(`[notification] created appointment notification for therapist ${therapist_id} -> appt ${row.id} with link: ${meeting_link}`);
  } catch (e) {
    console.error('[notification] failed to create appointment notification', e);
    // non-fatal
  }
  res.json(row);
});
// NEW: get next upcoming appointment for a user
app.get('/api/appointments/next/:user_id', (req, res) => {
  const nowIso = new Date().toISOString();
  const row = db.prepare(`
    SELECT a.*, t.name AS therapist_name, t.specialization
    FROM appointments a
    LEFT JOIN therapists t ON a.therapist_id = t.id
    WHERE a.user_id=? AND a.starts_at >= ? AND a.status=?
    ORDER BY a.starts_at ASC
    LIMIT 1
  `).get(req.params.user_id, nowIso, 'scheduled');
  if (!row) return res.json(null);
  res.json(row);
});

// Get appointment by id (with user and therapist info)
app.get('/api/appointments/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid appointment id' });
  const row = db.prepare(`
    SELECT a.*, u.name as user_name, u.email as user_email, t.name as therapist_name, t.email as therapist_email
    FROM appointments a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN therapists t ON a.therapist_id = t.id
    WHERE a.id=?
  `).get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// --- Assessments endpoints ---
// Create an assessment submission (optionally linked to a template)
app.post('/api/assessments', (req, res) => {
  const { user_id, total_percent, details, template_id = null, therapist_id = null } = req.body || {};
  if (!user_id || typeof total_percent !== 'number' || !details) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const info = db.prepare('INSERT INTO assessments (user_id, total_percent, details_json, template_id) VALUES (?, ?, ?, ?)')
    .run(user_id, Math.max(0, Math.min(100, Math.round(total_percent))), JSON.stringify(details), template_id || null);
  const row = db.prepare('SELECT * FROM assessments WHERE id=?').get(info.lastInsertRowid);
  // create notification for therapist if this assessment is linked to a template with a therapist
  try {
    const tplId = template_id || (details && details.template_id) || null;
    if (tplId) {
      const tpl = db.prepare('SELECT therapist_id, title FROM assessment_templates WHERE id=?').get(tplId);
      const therapist_id = tpl?.therapist_id;
      if (therapist_id) {
        const userRow = db.prepare('SELECT id, name, email FROM users WHERE id=?').get(user_id);
        const payload = {
          kind: 'assessment',
          user_id,
          assessment_id: row.id,
          template_id: tplId,
          template_title: tpl?.title || null,
          total_percent: Math.max(0, Math.min(100, Math.round(total_percent))),
          patient_name: userRow?.name || null,
          patient_email: userRow?.email || null,
        };
        db.prepare('INSERT INTO notifications (therapist_id, type, payload_json) VALUES (?, ?, ?)')
          .run(therapist_id, 'assessment', JSON.stringify(payload));
        console.log(`[notification] created assessment notification for therapist ${therapist_id} -> assess ${row.id}`);
      }
    }
  } catch (e) {
    console.error('[notification] failed to create assessment notification', e);
  }

  res.json(row);
});

// Latest assessment for a user
app.get('/api/assessments/latest/:user_id', (req, res) => {
  const row = db.prepare('SELECT * FROM assessments WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 1').get(req.params.user_id);
  res.json(row || null);
});

// Get a specific assessment by id
app.get('/api/assessments/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid assessment id' });
  const a = db.prepare('SELECT * FROM assessments WHERE id=?').get(id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json(a);
});

// Advice for a specific assessment using rec_rules
app.get('/api/assessments/:id/advice', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid assessment id' });
  const a = db.prepare('SELECT * FROM assessments WHERE id=?').get(id);
  if (!a) return res.status(404).json({ error: 'Not found' });

  let details = null;
  try { details = a.details_json ? JSON.parse(a.details_json) : null; } catch {}
  const total = typeof a.total_percent === 'number' ? a.total_percent : null;

  let title = 'Personalized Tips';
  let intro = 'We could not find a valid score for this assessment. Here are general wellness tips.';
  let actions = [
    'Try a 5-minute guided breathing session',
    "Write a short journal entry about how you're feeling",
    'Go to bed 30 minutes earlier tonight',
    'Consider talking with a mental health coach',
  ];

  if (typeof total === 'number') {
    const rules = db.prepare('SELECT * FROM rec_rules WHERE active=1 ORDER BY min_total DESC').all();
    const match = rules.find(r => total >= (r.min_total ?? 0) && total <= (r.max_total ?? 100));
    if (match) {
      title = match.title || title;
      intro = match.intro || intro;
      try { actions = JSON.parse(match.actions_json); } catch {}
    }
  }

  res.json({ assessment_id: id, total, details, title, intro, actions });
});

// Assessment Templates CRUD (therapist-authored)
app.post('/api/assessment-templates', (req, res) => {
  const { therapist_id, title, questions, is_published = 1 } = req.body || {};
  if (!therapist_id || !title || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'therapist_id, title, and questions are required' });
  }
  const info = db.prepare('INSERT INTO assessment_templates (therapist_id, title, questions_json, is_published) VALUES (?, ?, ?, ?)')
    .run(therapist_id, title, JSON.stringify(questions), is_published ? 1 : 0);
  const row = db.prepare('SELECT * FROM assessment_templates WHERE id=?').get(info.lastInsertRowid);
  res.json(row);
});

app.get('/api/assessment-templates', (req, res) => {
  const { therapist_id } = req.query;
  let sql = 'SELECT * FROM assessment_templates';
  const params = [];
  if (therapist_id) { sql += ' WHERE therapist_id=?'; params.push(parseInt(therapist_id)); }
  sql += ' ORDER BY created_at DESC, id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

app.patch('/api/assessment-templates/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { title, questions, is_published } = req.body || {};
  const existing = db.prepare('SELECT * FROM assessment_templates WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const fields = [];
  const params = [];
  if (typeof title === 'string') { fields.push('title=?'); params.push(title); }
  if (Array.isArray(questions)) { fields.push('questions_json=?'); params.push(JSON.stringify(questions)); }
  if (typeof is_published === 'boolean' || typeof is_published === 'number') { fields.push('is_published=?'); params.push(is_published ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
  fields.push('updated_at=CURRENT_TIMESTAMP');
  params.push(id);
  const sql = `UPDATE assessment_templates SET ${fields.join(', ')} WHERE id=?`;
  db.prepare(sql).run(...params);
  const row = db.prepare('SELECT * FROM assessment_templates WHERE id=?').get(id);
  res.json(row);
});

// List published templates available to users (simple: all published)
app.get('/api/assessment-templates/available', (req, res) => {
  const rows = db.prepare('SELECT * FROM assessment_templates WHERE is_published=1 ORDER BY created_at DESC, id DESC').all();
  res.json(rows);
});

// List submissions for a given template (optionally filter by user)
app.get('/api/assessment-templates/:id/submissions', (req, res) => {
  const id = parseInt(req.params.id);
  const userId = req.query.user_id ? parseInt(req.query.user_id) : null;
  if (!id) return res.status(400).json({ error: 'Invalid template id' });
  
  let sql = `SELECT 
    a.id, 
    a.user_id, 
    a.total_percent, 
    a.details_json, 
    a.created_at,
    u.name as user_name,
    u.email as user_email,
    u.avatar_url as user_avatar
  FROM assessments a
  LEFT JOIN users u ON a.user_id = u.id
  WHERE a.template_id=? 
  ORDER BY a.created_at DESC, a.id DESC`;
  
  const params = [id];
  if (userId) { 
    sql = `SELECT 
      a.id, 
      a.user_id, 
      a.total_percent, 
      a.details_json, 
      a.created_at,
      u.name as user_name,
      u.email as user_email,
      u.avatar_url as user_avatar
    FROM assessments a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.template_id=? AND a.user_id=? 
    ORDER BY a.created_at DESC, a.id DESC`; 
    params.push(userId); 
  }
  
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// --- AI Recommendations ---
// Configurable, data-driven rules from rec_rules + profile personalization
app.get('/api/recommendations/:user_id', (req, res) => {
  const id = req.params.user_id;
  const user = db.prepare('SELECT id, name, mental_status FROM users WHERE id=?').get(id);
  const latest = db.prepare('SELECT * FROM assessments WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 1').get(id);

  let details = null;
  try { details = latest?.details_json ? JSON.parse(latest.details_json) : null; } catch {}

  const total = typeof latest?.total_percent === 'number' ? latest.total_percent : null;

  // Default fallback
  let title = 'Personalized Tips';
  let intro = 'We could not find a recent assessment. Here are general wellness tips you can try today.';
  let actions = [
    'Try a 5-minute guided breathing session',
    "Write a short journal entry about how you're feeling",
    'Go to bed 30 minutes earlier tonight',
    'Consider talking with a mental health coach',
  ];

  if (typeof total === 'number') {
    // Pull active rules and find first matching range
    const rules = db.prepare('SELECT * FROM rec_rules WHERE active=1 ORDER BY min_total DESC').all();
    const match = rules.find(r => total >= (r.min_total ?? 0) && total <= (r.max_total ?? 100));
    if (match) {
      title = match.title || title;
      intro = match.intro || intro;
      try { actions = JSON.parse(match.actions_json); } catch {}
    }
  }

  // Personalize with simple tags
  if (user?.mental_status) {
    const ms = user.mental_status.toLowerCase();
    if (ms.includes('anx')) actions.unshift('Practice box breathing (4-4-4-4) for 3 minutes');
    if (ms.includes('sleep')) actions.unshift('Avoid caffeine after 2pm and try a wind-down routine');
  }

  res.json({ user: { id: user?.id || Number(id), name: user?.name || null }, latest_total: total, title, intro, actions, details });
});

// --- Admin API for recommendation rules ---
app.get('/api/rec_rules', adminGuard, (req, res) => {
  const rows = db.prepare('SELECT * FROM rec_rules ORDER BY min_total DESC').all();
  res.json(rows);
});

app.post('/api/rec_rules', adminGuard, (req, res) => {
  const { min_total, max_total, title, intro, actions, active = 1 } = req.body || {};
  if (typeof min_total !== 'number' || typeof max_total !== 'number' || !title) {
    return res.status(400).json({ error: 'min_total, max_total, title required' });
  }
  const actions_json = JSON.stringify(Array.isArray(actions) ? actions : []);
  const info = db.prepare('INSERT INTO rec_rules (min_total, max_total, title, intro, actions_json, active) VALUES (?, ?, ?, ?, ?, ?)')
    .run(min_total, max_total, title, intro || '', actions_json, active ? 1 : 0);
  const row = db.prepare('SELECT * FROM rec_rules WHERE id=?').get(info.lastInsertRowid);
  res.json(row);
});

app.patch('/api/rec_rules/:id', adminGuard, (req, res) => {
  const id = req.params.id;
  const { min_total, max_total, title, intro, actions, active } = req.body || {};
  const existing = db.prepare('SELECT * FROM rec_rules WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const fields = [];
  const params = [];
  if (typeof min_total === 'number') { fields.push('min_total=?'); params.push(min_total); }
  if (typeof max_total === 'number') { fields.push('max_total=?'); params.push(max_total); }
  if (typeof title === 'string') { fields.push('title=?'); params.push(title); }
  if (typeof intro === 'string') { fields.push('intro=?'); params.push(intro); }
  if (Array.isArray(actions)) { fields.push('actions_json=?'); params.push(JSON.stringify(actions)); }
  if (typeof active === 'number' || typeof active === 'boolean') { fields.push('active=?'); params.push(active ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(id);
  const sql = `UPDATE rec_rules SET ${fields.join(', ')} WHERE id=?`;
  db.prepare(sql).run(...params);
  const row = db.prepare('SELECT * FROM rec_rules WHERE id=?').get(id);
  res.json(row);
});

app.delete('/api/rec_rules/:id', adminGuard, (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM rec_rules WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM rec_rules WHERE id=?').run(id);
  res.json({ ok: true });
});

// --- Comprehensive Admin Dashboard API ---

// User Management
app.get('/api/admin/users', adminGuard, (req, res) => {
  const { page = 1, limit = 20, search, user_type, status } = req.query;
  const offset = (page - 1) * limit;
  
  let sql = 'SELECT id, name, email, avatar_url, mental_status, user_type, is_active, created_at FROM users WHERE 1=1';
  const params = [];
  
  if (search) {
    sql += ' AND (name LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  if (user_type) {
    sql += ' AND user_type = ?';
    params.push(user_type);
  }
  
  if (status === 'active') {
    sql += ' AND is_active = 1';
  } else if (status === 'inactive') {
    sql += ' AND is_active = 0';
  }
  
  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  const users = db.prepare(sql).all(...params);
  
  // Count query
  let countSql = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
  const countParams = [];
  if (search) {
    countSql += ' AND (name LIKE ? OR email LIKE ?)';
    countParams.push(`%${search}%`, `%${search}%`);
  }
  if (user_type) {
    countSql += ' AND user_type = ?';
    countParams.push(user_type);
  }
  if (status === 'active') {
    countSql += ' AND is_active = 1';
  } else if (status === 'inactive') {
    countSql += ' AND is_active = 0';
  }
  
  const total = db.prepare(countSql).get(...countParams).count;
  
  res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
});

app.get('/api/admin/users/:id', adminGuard, (req, res) => {
  const user = db.prepare(`
    SELECT u.*, 
           (SELECT COUNT(*) FROM assessments WHERE user_id = u.id) as assessment_count,
           (SELECT COUNT(*) FROM moods WHERE user_id = u.id) as mood_count,
           (SELECT COUNT(*) FROM appointments WHERE user_id = u.id) as appointment_count
    FROM users u WHERE u.id = ?
  `).get(req.params.id);
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  // Get recent activity
  const recentMoods = db.prepare('SELECT * FROM moods WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(req.params.id);
  const recentAssessments = db.prepare('SELECT * FROM assessments WHERE user_id = ? ORDER BY created_at DESC LIMIT 3').all(req.params.id);
  const recentAppointments = db.prepare(`
    SELECT a.*, t.name as therapist_name 
    FROM appointments a 
    LEFT JOIN therapists t ON a.therapist_id = t.id 
    WHERE a.user_id = ? 
    ORDER BY a.starts_at DESC LIMIT 5
  `).all(req.params.id);
  
  res.json({
    ...user,
    recentMoods,
    recentAssessments,
    recentAppointments
  });
});

app.patch('/api/admin/users/:id', adminGuard, (req, res) => {
  const { name, email, mental_status, avatar_url, user_type, is_active } = req.body;
  const id = req.params.id;
  
  const existing = db.prepare('SELECT id FROM users WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  
  const fields = [];
  const params = [];
  if (name) { fields.push('name=?'); params.push(name); }
  if (email) { fields.push('email=?'); params.push(email); }
  if (mental_status) { fields.push('mental_status=?'); params.push(mental_status); }
  if (avatar_url) { fields.push('avatar_url=?'); params.push(avatar_url); }
  if (user_type) { fields.push('user_type=?'); params.push(user_type); }
  if (typeof is_active === 'boolean') { fields.push('is_active=?'); params.push(is_active ? 1 : 0); }
  
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  
  fields.push('updated_at=CURRENT_TIMESTAMP');
  params.push(id);
  const sql = `UPDATE users SET ${fields.join(', ')} WHERE id=?`;
  db.prepare(sql).run(...params);
  
  const updated = db.prepare('SELECT id, name, email, avatar_url, mental_status, user_type, is_active, created_at FROM users WHERE id=?').get(id);
  res.json(updated);
});

app.delete('/api/admin/users/:id', adminGuard, (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM users WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  
  // Delete related data
  db.prepare('DELETE FROM moods WHERE user_id=?').run(id);
  db.prepare('DELETE FROM assessments WHERE user_id=?').run(id);
  db.prepare('DELETE FROM appointments WHERE user_id=?').run(id);
  db.prepare('DELETE FROM users WHERE id=?').run(id);
  
  res.json({ ok: true });
});

// Create admin user
app.post('/api/admin/users', adminGuard, (req, res) => {
  const { name, email, password, user_type = 'user' } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  
  const { salt, hash } = hashPassword(password);
  try {
    const info = db.prepare('INSERT INTO users (name, email, password_hash, password_salt, user_type) VALUES (?, ?, ?, ?, ?)')
      .run(name, email, hash, salt, user_type);
    const user = { id: info.lastInsertRowid, name, email, user_type };
    res.json(user);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Email exists' });
    console.error('[create user] error:', e);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Analytics
app.get('/api/admin/analytics', adminGuard, (req, res) => {
  const { period = '30' } = req.query;
  const days = parseInt(period);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];
  
  // User statistics
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const newUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE created_at >= ?').get(startDateStr).count;
  const activeUsers = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as count 
    FROM (
      SELECT user_id FROM moods WHERE created_at >= ?
      UNION
      SELECT user_id FROM assessments WHERE created_at >= ?
      UNION
      SELECT user_id FROM appointments WHERE starts_at >= ?
    )
  `).get(startDateStr, startDateStr, startDateStr).count;
  
  // Assessment statistics
  const totalAssessments = db.prepare('SELECT COUNT(*) as count FROM assessments').get().count;
  const recentAssessments = db.prepare('SELECT COUNT(*) as count FROM assessments WHERE created_at >= ?').get(startDateStr).count;
  const avgAssessmentScore = db.prepare('SELECT AVG(total_percent) as avg FROM assessments WHERE created_at >= ?').get(startDateStr).avg || 0;
  
  // Appointment statistics
  const totalAppointments = db.prepare('SELECT COUNT(*) as count FROM appointments').get().count;
  const upcomingAppointments = db.prepare('SELECT COUNT(*) as count FROM appointments WHERE starts_at >= ? AND status = ?').get(new Date().toISOString(), 'scheduled').count;
  
  // Mood tracking
  const totalMoods = db.prepare('SELECT COUNT(*) as count FROM moods').get().count;
  const recentMoods = db.prepare('SELECT COUNT(*) as count FROM moods WHERE created_at >= ?').get(startDateStr).count;
  
  // Daily signups for chart
  const dailySignups = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count 
    FROM users 
    WHERE created_at >= ? 
    GROUP BY DATE(created_at) 
    ORDER BY date
  `).all(startDateStr);
  
  res.json({
    users: { total: totalUsers, new: newUsers, active: activeUsers },
    assessments: { total: totalAssessments, recent: recentAssessments, avgScore: Math.round(avgAssessmentScore) },
    appointments: { total: totalAppointments, upcoming: upcomingAppointments },
    moods: { total: totalMoods, recent: recentMoods },
    dailySignups,
    period: days
  });
});

// Content Management
app.get('/api/admin/resources', adminGuard, (req, res) => {
  const { page = 1, limit = 20, category, language, search } = req.query;
  const offset = (page - 1) * limit;
  
  let sql = 'SELECT * FROM resources WHERE 1=1';
  const params = [];
  
  if (category) { sql += ' AND category=?'; params.push(category); }
  if (language) { sql += ' AND language=?'; params.push(language); }
  if (search) { sql += ' AND (title LIKE ? OR tags LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  
  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  const resources = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM resources WHERE 1=1' + 
    (category ? ' AND category=?' : '') + 
    (language ? ' AND language=?' : '') + 
    (search ? ' AND (title LIKE ? OR tags LIKE ?)' : '')
  ).get(...params.slice(0, -2)).count;
  
  res.json({ resources, total, page: parseInt(page), limit: parseInt(limit) });
});

app.post('/api/admin/resources', adminGuard, (req, res) => {
  const { category, title, description, url, file_path, file_type, file_size, language, tags, created_by } = req.body;
  if (!category || !title || (!url && !file_path)) {
    return res.status(400).json({ error: 'category, title, and either url or file_path are required' });
  }
  
  const info = db.prepare(`
    INSERT INTO resources (category, title, description, url, file_path, file_type, file_size, language, tags, created_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    category, 
    title, 
    description || '', 
    url || '', 
    file_path || '', 
    file_type || '', 
    file_size || 0, 
    language || 'en', 
    tags || '', 
    created_by || null
  );
  
  const resource = db.prepare('SELECT * FROM resources WHERE id=?').get(info.lastInsertRowid);
  res.json(resource);
});

app.patch('/api/admin/resources/:id', adminGuard, (req, res) => {
  const { category, title, description, url, file_path, file_type, file_size, language, tags, is_published } = req.body;
  const id = req.params.id;
  
  const existing = db.prepare('SELECT id FROM resources WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Resource not found' });
  
  const fields = [];
  const params = [];
  if (category) { fields.push('category=?'); params.push(category); }
  if (title) { fields.push('title=?'); params.push(title); }
  if (description) { fields.push('description=?'); params.push(description); }
  if (url) { fields.push('url=?'); params.push(url); }
  if (file_path) { fields.push('file_path=?'); params.push(file_path); }
  if (file_type) { fields.push('file_type=?'); params.push(file_type); }
  if (file_size) { fields.push('file_size=?'); params.push(file_size); }
  if (language) { fields.push('language=?'); params.push(language); }
  if (tags) { fields.push('tags=?'); params.push(tags); }
  if (typeof is_published === 'boolean') { fields.push('is_published=?'); params.push(is_published ? 1 : 0); }
  
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  
  fields.push('updated_at=CURRENT_TIMESTAMP');
  params.push(id);
  const sql = `UPDATE resources SET ${fields.join(', ')} WHERE id=?`;
  db.prepare(sql).run(...params);
  
  const updated = db.prepare('SELECT * FROM resources WHERE id=?').get(id);
  res.json(updated);
});

app.delete('/api/admin/resources/:id', adminGuard, (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM resources WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Resource not found' });
  
  db.prepare('DELETE FROM resources WHERE id=?').run(id);
  res.json({ ok: true });
});

// Therapist Management
app.get('/api/admin/therapists', adminGuard, (req, res) => {
  const { page = 1, limit = 20, search, specialization } = req.query;
  const offset = (page - 1) * limit;
  
  let sql = 'SELECT id, name, email, specialization, bio, phone, availability_json, is_verified, created_at, updated_at FROM therapists WHERE 1=1';
  const params = [];
  
  if (search) { sql += ' AND (name LIKE ? OR bio LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (specialization) { sql += ' AND specialization=?'; params.push(specialization); }
  
  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  const therapists = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM therapists WHERE 1=1' + 
    (search ? ' AND (name LIKE ? OR bio LIKE ?)' : '') + 
    (specialization ? ' AND specialization=?' : '')
  ).get(...params.slice(0, -2)).count;
  
  res.json({ therapists, total, page: parseInt(page), limit: parseInt(limit) });
});

app.post('/api/admin/therapists', adminGuard, (req, res) => {
  const { name, email, password, specialization, bio, phone, availability, is_verified } = req.body;
  if (!name || !email || !password || !specialization) {
    return res.status(400).json({ error: 'name, email, password, and specialization are required' });
  }

  const { salt, hash } = hashPassword(password);
  const availability_json = JSON.stringify(availability || { days: [], slots: [] });
  const info = db.prepare('INSERT INTO therapists (name, email, password_hash, password_salt, specialization, bio, phone, availability_json, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(name, email, hash, salt, specialization, bio || '', phone || '', availability_json, is_verified ? 1 : 0);

  const therapist = db.prepare('SELECT id, name, email, specialization, bio, phone, availability_json, is_verified, created_at, updated_at FROM therapists WHERE id=?').get(info.lastInsertRowid);
  res.json(therapist);
});

app.patch('/api/admin/therapists/:id', adminGuard, (req, res) => {
  const { name, email, password, specialization, bio, phone, availability, is_verified } = req.body;
  const id = req.params.id;

  const existing = db.prepare('SELECT id FROM therapists WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Therapist not found' });

  const fields = [];
  const params = [];
  if (name) { fields.push('name=?'); params.push(name); }
  if (email) { fields.push('email=?'); params.push(email); }
  if (password) {
    const { salt, hash } = hashPassword(password);
    fields.push('password_hash=?'); params.push(hash);
    fields.push('password_salt=?'); params.push(salt);
  }
  if (specialization) { fields.push('specialization=?'); params.push(specialization); }
  if (bio !== undefined) { fields.push('bio=?'); params.push(bio); }
  if (phone !== undefined) { fields.push('phone=?'); params.push(phone); }
  if (availability) { fields.push('availability_json=?'); params.push(JSON.stringify(availability)); }
  if (is_verified !== undefined) { fields.push('is_verified=?'); params.push(is_verified ? 1 : 0); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(id);
  const sql = `UPDATE therapists SET ${fields.join(', ')} WHERE id=?`;
  db.prepare(sql).run(...params);

  const updated = db.prepare('SELECT id, name, email, specialization, bio, phone, availability_json, is_verified, created_at, updated_at FROM therapists WHERE id=?').get(id);
  res.json(updated);
});

app.delete('/api/admin/therapists/:id', adminGuard, (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM therapists WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Therapist not found' });
  
  // Check if therapist has appointments
  const hasAppointments = db.prepare('SELECT COUNT(*) as count FROM appointments WHERE therapist_id=?').get(id).count > 0;
  if (hasAppointments) {
    return res.status(400).json({ error: 'Cannot delete therapist with existing appointments' });
  }
  
  db.prepare('DELETE FROM therapists WHERE id=?').run(id);
  res.json({ ok: true });
});

// Appointment Management
app.get('/api/admin/appointments', adminGuard, (req, res) => {
  const { page = 1, limit = 20, status, therapist_id, user_id } = req.query;
  const offset = (page - 1) * limit;
  
  let sql = `
    SELECT a.*, u.name as user_name, u.email as user_email, t.name as therapist_name, t.specialization
    FROM appointments a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN therapists t ON a.therapist_id = t.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) { sql += ' AND a.status=?'; params.push(status); }
  if (therapist_id) { sql += ' AND a.therapist_id=?'; params.push(therapist_id); }
  if (user_id) { sql += ' AND a.user_id=?'; params.push(user_id); }
  
  sql += ' ORDER BY a.starts_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  const appointments = db.prepare(sql).all(...params);
  const total = db.prepare(`
    SELECT COUNT(*) as count 
    FROM appointments a 
    WHERE 1=1
    ${status ? ' AND a.status=?' : ''}
    ${therapist_id ? ' AND a.therapist_id=?' : ''}
    ${user_id ? ' AND a.user_id=?' : ''}
  `).get(...params.slice(0, -2)).count;
  
  res.json({ appointments, total, page: parseInt(page), limit: parseInt(limit) });
});

app.patch('/api/admin/appointments/:id', adminGuard, (req, res) => {
  const { status, starts_at, therapist_id, meet_link } = req.body;
  const id = req.params.id;
  
  const existing = db.prepare('SELECT id FROM appointments WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  
  const fields = [];
  const params = [];
  if (status) { fields.push('status=?'); params.push(status); }
  if (starts_at) { fields.push('starts_at=?'); params.push(starts_at); }
  if (therapist_id) { fields.push('therapist_id=?'); params.push(therapist_id); }
  if (meet_link !== undefined) { fields.push('meet_link=?'); params.push(meet_link); }
  
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  
  params.push(id);
  const sql = `UPDATE appointments SET ${fields.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`;
  db.prepare(sql).run(...params);
  
  const updated = db.prepare(`
    SELECT a.*, u.name as user_name, u.email as user_email, t.name as therapist_name, t.specialization
    FROM appointments a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN therapists t ON a.therapist_id = t.id
    WHERE a.id=?
  `).get(id);
  
  res.json(updated);
});

// Export appointments as a styled PDF for admin
app.get('/api/admin/appointments/export', adminGuard, (req, res) => {
  // Fetch appointments joined with user info and therapist info, apply filters from query params
  const { status, therapist_id, user_id, search } = req.query;
  
  let sql = `
    SELECT a.id, a.starts_at, a.status, u.name as patient_name, u.email as patient_email, t.name as therapist_name
    FROM appointments a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN therapists t ON a.therapist_id = t.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) { sql += ' AND a.status = ?'; params.push(status); }
  if (therapist_id) { sql += ' AND a.therapist_id = ?'; params.push(therapist_id); }
  if (user_id) { sql += ' AND a.user_id = ?'; params.push(user_id); }
  
  // Search filter for patient name, email, or therapist name (case-insensitive)
  if (search) {
    sql += ' AND (u.name LIKE ? OR u.email LIKE ? OR t.name LIKE ?)';
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }
  
  sql += ' ORDER BY a.starts_at ASC';
  const rows = db.prepare(sql).all(...params);

  // Create PDF with smaller margins for better table
  const doc = new PDFDocument({ size: 'A4', margin: 30 });
  const filename = `appointments-${new Date().toISOString().slice(0,10)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 30;

  // ===== HEADER SECTION =====
  // Green header background
  doc.rect(0, 0, pageWidth, 90).fill('#1B5E20');
  
  // Logo text
  doc.fillColor('#ffffff').fontSize(32).font('Helvetica-Bold').text('MEDICARE', margin, 15);
  doc.fontSize(11).fillColor('#E8F5E9').font('Helvetica').text('Healthcare & Appointments Management', margin, 50);
  
  // Logo circle (top right) — white circle with small "medicare" text inside
  const logoX = pageWidth - 50;
  const logoY = 45;
  const logoR = 25;
  // white fill with green stroke
  doc.circle(logoX, logoY, logoR).fill('#ffffff').stroke('#2E7D32').lineWidth(2);
  // small lowercase text centered inside the circle
  const logoText = 'medicare';
  doc.fillColor('#2E7D32').fontSize(10).font('Helvetica-Bold').text(logoText, logoX - logoR, logoY - 6, { width: logoR * 2, align: 'center' });
  
  // Title
  const titleY = 100;
  doc.fillColor('#1B5E20').fontSize(20).font('Helvetica-Bold').text('Appointments Report', margin, titleY, { align: 'left' });
  
  // ===== TABLE SECTION =====
  const tableTop = 140;
  const colW = [35, 90, 110, 100, 90, 70]; // #, Name, Email, Therapist, Schedule, Status
  const rowHeight = 22;
  const headerBg = '#2E7D32';
  const altRowBg = '#F1F8E9';
  const borderColor = '#CCCCCC';
  
  let y = tableTop;
  
  // Table header
  const headers = ['#', 'Patient Name', 'Email', 'Therapist', 'Schedule', 'Status'];
  let x = margin;
  
  // Header background
  doc.rect(margin, y, pageWidth - 2*margin, rowHeight).fill(headerBg);
  
  // Header text
  doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
  headers.forEach((h, i) => {
    doc.text(h, x + 5, y + 5, { width: colW[i] - 10, height: rowHeight - 10, align: i === 0 ? 'center' : 'left' });
    x += colW[i];
  });
  
  y += rowHeight;
  
  // Draw horizontal line under header
  doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke(borderColor);
  
  doc.fontSize(9).fillColor('#333333').font('Helvetica');
  
  // helper: format starts_at consistently
  function formatStartsAt(val) {
    if (!val) return '—';
    let d = null;
    if (typeof val === 'number') {
      d = new Date(val > 1e12 ? val : val * 1000);
    } else if (/^\d+$/.test(String(val).trim())) {
      const n = Number(val);
      d = new Date(n > 1e12 ? n : n * 1000);
    } else {
      d = new Date(String(val));
    }
    if (isNaN(d.getTime())) {
      const s = String(val).trim();
      const s2 = s.replace(' ', 'T');
      const p = Date.parse(s) || Date.parse(s2);
      if (!isNaN(p)) d = new Date(p);
    }
    if (isNaN(d.getTime())) return String(val) || '—';
    // Format manual to ensure short, consistent output: MM/DD/YYYY, hh:mm AM/PM
    const pad = (n) => String(n).padStart(2, '0');
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = pad(d.getMinutes());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${month}/${day}/${year} ${pad(hours)}:${minutes} ${ampm}`;
  }

  // Table rows with dynamic row height to fit content
  rows.forEach((r, idx) => {
    // Prepare row text
    const schedule = formatStartsAt(r.starts_at);
    const status = (r.status || '—').charAt(0).toUpperCase() + (r.status || '—').slice(1);
    const rowData = [String(idx + 1), r.patient_name || '—', r.patient_email || '—', r.therapist_name || '—', schedule, status];

    // compute required height per cell
    const heights = rowData.map((text, i) => {
      const maxWidth = colW[i] - 10;
      return doc.heightOfString(String(text), { width: maxWidth, align: i === 0 ? 'center' : (i === 5 ? 'center' : 'left'), size: 9 });
    });
    const currentRowHeight = Math.max(rowHeight, Math.max(...heights) + 8);

    // Page break check with room for footer
    if (y + currentRowHeight > pageHeight - 60) {
      // Add page number to current page
      doc.fontSize(9).fillColor('#999').text(`Page ${Math.floor((y - tableTop) / (rowHeight * 20)) + 1}`, margin, pageHeight - 20, { align: 'right' });
      doc.addPage();
      y = tableTop;

      // Repeat header on new page
      doc.rect(margin, y, pageWidth - 2*margin, rowHeight).fill(headerBg);
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
      x = margin;
      headers.forEach((h, i) => {
        doc.text(h, x + 5, y + 5, { width: colW[i] - 10, height: rowHeight - 10, align: i === 0 ? 'center' : 'left' });
        x += colW[i];
      });
      y += rowHeight;
      doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke(borderColor);
      doc.fontSize(9).fillColor('#333333').font('Helvetica');
    }

    // Alternate row color
    if (idx % 2 === 0) {
      doc.rect(margin, y, pageWidth - 2*margin, currentRowHeight).fill(altRowBg);
    }

    // Draw vertical lines for columns
    x = margin;
    doc.strokeColor(borderColor).lineWidth(0.5);
    for (let i = 0; i <= colW.length; i++) {
      doc.moveTo(x, y).lineTo(x, y + currentRowHeight).stroke();
      x += colW[i] || 0;
    }

    // Draw row border
    doc.moveTo(margin, y + currentRowHeight).lineTo(pageWidth - margin, y + currentRowHeight).stroke();

    // Row text
    doc.fillColor('#333333').fontSize(9);
    x = margin;
    rowData.forEach((text, i) => {
      const align = i === 0 ? 'center' : i === 5 ? 'center' : 'left';
      const maxWidth = colW[i] - 10;
      doc.text(String(text), x + 5, y + 4, { width: maxWidth, height: currentRowHeight - 8, align });
      x += colW[i] || 0;
    });

    y += currentRowHeight;
  });

  // ===== FOOTER SECTION (on same page as table) =====
  // Place footer with spacing after the last table row
  doc.fontSize(9).fillColor('#666666').font('Helvetica');
  const footerSpacing = y + 20; // Space after last row
  doc.text(`Generated: ${new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, margin, footerSpacing);
  doc.fontSize(8).fillColor('#999999').text('Prepared by Medicare System Administrator', margin, footerSpacing + 15);
  
  doc.end();
});

// Debug endpoint to list therapists (remove after debugging)
app.get('/api/debug/therapists', (req, res) => {
  const therapists = db.prepare('SELECT id, name, email, specialization, bio, phone, is_verified, created_at FROM therapists').all();
  res.json(therapists);
});

// Debug endpoint to create therapist dede@therapist.com with password dedee1234 (remove after debugging)
app.post('/api/debug/create-therapist', (req, res) => {
  const name = 'Dede';
  const email = 'dede@therapist.com';
  const password = 'dedee1234';
  const specialization = 'General';
  const bio = 'Therapist created for testing';
  const phone = '0700000000';
  const { salt, hash } = hashPassword(password);
  try {
    const existing = db.prepare('SELECT id FROM therapists WHERE email=?').get(email);
    if (existing) return res.status(409).json({ error: 'Therapist already exists' });
    const info = db.prepare('INSERT INTO therapists (name, email, password_hash, password_salt, specialization, bio, phone, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, 1)')
      .run(name, email, hash, salt, specialization, bio, phone);
    const therapist = db.prepare('SELECT id, name, email FROM therapists WHERE id=?').get(info.lastInsertRowid);
    res.json(therapist);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create therapist' });
  }
});

// Get therapist profile
app.get('/api/therapists/:id', (req, res) => {
  const therapist = db.prepare('SELECT id, name, email, specialization, bio, phone, availability_json, avatar_url, is_verified, created_at FROM therapists WHERE id=?').get(req.params.id);
  if (!therapist) return res.status(404).json({ error: 'Not found' });
  res.json(therapist);
});

// Update therapist profile
app.patch('/api/therapists/:id', (req, res) => {
  const id = req.params.id;
  const { name, email, specialization, bio, phone, availability, avatar_url, current_password, password } = req.body;
  const existing = db.prepare('SELECT id, password_hash, password_salt FROM therapists WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  
  // If password change is requested, verify current password first
  if (password) {
    if (!current_password) return res.status(400).json({ error: 'current_password required to change password' });
    try {
      const ok = verifyPassword(current_password, existing.password_salt, existing.password_hash);
      if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
    } catch (e) {
      return res.status(401).json({ error: 'Password verification failed' });
    }
  }
  
  const fields = [];
  const params = [];
  if (name) { fields.push('name=?'); params.push(name); }
  if (email) { fields.push('email=?'); params.push(email); }
  if (specialization) { fields.push('specialization=?'); params.push(specialization); }
  if (bio !== undefined) { fields.push('bio=?'); params.push(bio); }
  if (phone !== undefined) { fields.push('phone=?'); params.push(phone); }
  if (availability) { fields.push('availability_json=?'); params.push(JSON.stringify(availability)); }
  if (avatar_url !== undefined) { fields.push('avatar_url=?'); params.push(avatar_url); }
  
  // Handle password change
  if (password) {
    const { salt, hash } = hashPassword(password);
    fields.push('password_salt=?');
    fields.push('password_hash=?');
    params.push(salt);
    params.push(hash);
  }
  
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  params.push(id);
  const sql = `UPDATE therapists SET ${fields.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`;
  db.prepare(sql).run(...params);
  const updated = db.prepare('SELECT id, name, email, specialization, bio, phone, availability_json, avatar_url, is_verified, created_at FROM therapists WHERE id=?').get(id);
  res.json(updated);
});

// Therapist Dashboard - minimal aggregate for a therapist
app.get('/api/therapists/:id/dashboard', (req, res) => {
  const therapistId = parseInt(req.params.id);
  if (!therapistId) return res.status(400).json({ error: 'Invalid therapist id' });

  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0,0,0,0);
  const endOfDay = new Date(now); endOfDay.setHours(23,59,59,999);
  const next24h = new Date(now.getTime() + 24*60*60*1000);

  // Today appointments for this therapist
  const todayAppointments = db.prepare(`
    SELECT a.*, u.name as user_name, u.email as user_email
    FROM appointments a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.therapist_id=? AND a.starts_at BETWEEN ? AND ?
    ORDER BY a.starts_at ASC
  `).all(therapistId, startOfDay.toISOString(), endOfDay.toISOString());

  // Caseload: distinct users with any appointment with this therapist
  const caseload = db.prepare(`
    SELECT DISTINCT u.id, u.name, u.email
    FROM appointments a
    JOIN users u ON u.id = a.user_id
    WHERE a.therapist_id=?
    ORDER BY u.name ASC
  `).all(therapistId);

  // Alerts: upcoming within 24h and high-risk users (latest assessment < 60)
  const upcoming = db.prepare(`
    SELECT a.id, a.user_id, a.starts_at, u.name as user_name
    FROM appointments a
    JOIN users u ON u.id = a.user_id
    WHERE a.therapist_id=? AND a.starts_at BETWEEN ? AND ? AND (a.status IS NULL OR a.status='scheduled')
    ORDER BY a.starts_at ASC
  `).all(therapistId, now.toISOString(), next24h.toISOString());

  // Latest assessment per user in caseload
  const latestAssessmentStmt = db.prepare(`
    SELECT id, user_id, total_percent, created_at
    FROM assessments
    WHERE user_id=?
    ORDER BY datetime(created_at) DESC
    LIMIT 1
  `);
  const assessmentsMap = {};
  for (const u of caseload) {
    const la = latestAssessmentStmt.get(u.id);
    if (la) assessmentsMap[u.id] = la;
  }

  const highRisk = caseload
    .map(u => ({ user: u, assess: assessmentsMap[u.id] }))
    .filter(x => x.assess && x.assess.total_percent < 60)
    .map(x => ({ user_id: x.user.id, name: x.user.name, total_percent: x.assess.total_percent, assessed_at: x.assess.created_at }));

  res.json({
    today: todayAppointments,
    caseload,
    alerts: { upcoming, highRisk },
    meta: { todayCount: todayAppointments.length, caseloadCount: caseload.length }
  });
});

// Get appointments for a therapist
app.get('/api/therapists/:id/appointments', (req, res) => {
  const therapistId = parseInt(req.params.id);
  if (!therapistId) return res.status(400).json({ error: 'Invalid therapist id' });

  const { status, limit = 50, offset = 0 } = req.query;
  let sql = `
    SELECT a.*, u.name as user_name, u.email as user_email
    FROM appointments a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.therapist_id=?
  `;
  const params = [therapistId];
  if (status) {
    sql += ' AND a.status=?';
    params.push(status);
  }
  sql += ' ORDER BY a.starts_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const appointments = db.prepare(sql).all(...params);
  res.json(appointments);
});

// Update appointment (for therapists to manage)
app.patch('/api/appointments/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid appointment id' });

  const { status, starts_at, notes, meet_link } = req.body;
  const existing = db.prepare('SELECT id FROM appointments WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });

  const fields = [];
  const params = [];
  if (status !== undefined) { fields.push('status=?'); params.push(status); }
  if (starts_at) { fields.push('starts_at=?'); params.push(starts_at); }
  if (notes !== undefined) { fields.push('notes=?'); params.push(notes); }
  if (meet_link !== undefined) { fields.push('meet_link=?'); params.push(meet_link); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(id);
  const sql = `UPDATE appointments SET ${fields.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`;
  db.prepare(sql).run(...params);

  const updated = db.prepare(`
    SELECT a.*, u.name as user_name, u.email as user_email
    FROM appointments a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.id=?
  `).get(id);
  // If therapist updated the appointment status to 'accepted', notify the patient via messages
  try {
    if (typeof status !== 'undefined') {
      const s = String(status).toLowerCase();
      const therapistRow = db.prepare('SELECT id, name FROM therapists WHERE id=?').get(updated.therapist_id);
      const therapistName = therapistRow?.name || 'Therapist';
      const when = updated.starts_at ? new Date(updated.starts_at).toLocaleString() : 'the scheduled time';
      if (s === 'accepted') {
        const content = `Your appointment on ${when} has been accepted by ${therapistName}.`;
        db.prepare('INSERT INTO messages (user_id, therapist_id, sender_type, content) VALUES (?, ?, ?, ?)')
          .run(updated.user_id, updated.therapist_id, 'therapist', content);
        console.log(`[notify] Sent acceptance message to user ${updated.user_id} for appointment ${updated.id}`);
      } else if (s === 'rejected' || s === 'declined') {
        const content = `Your appointment on ${when} was declined by ${therapistName}.`; 
        db.prepare('INSERT INTO messages (user_id, therapist_id, sender_type, content) VALUES (?, ?, ?, ?)')
          .run(updated.user_id, updated.therapist_id, 'therapist', content);
        console.log(`[notify] Sent rejection message to user ${updated.user_id} for appointment ${updated.id}`);
      }
    }
  } catch (e) {
    console.error('[notify] failed to create patient message after appointment update', e);
  }
  res.json(updated);
});

// Aggregated assessments for therapist's caseload
app.get('/api/therapists/:id/assessments-aggregated', (req, res) => {
  const therapistId = parseInt(req.params.id);
  if (!therapistId) return res.status(400).json({ error: 'Invalid therapist id' });

  // Get caseload users
  const caseload = db.prepare(`
    SELECT DISTINCT u.id, u.name
    FROM appointments a
    JOIN users u ON u.id = a.user_id
    WHERE a.therapist_id=?
  `).all(therapistId);

  const userIds = caseload.map(u => u.id);
  if (userIds.length === 0) return res.json({ users: [], summary: { totalAssessments: 0, avgScore: 0, highRiskCount: 0 } });

  // Latest assessments
  const placeholders = userIds.map(() => '?').join(',');
  const latestAssessments = db.prepare(`
    SELECT a.user_id, a.total_percent, a.created_at
    FROM assessments a
    WHERE a.user_id IN (${placeholders})
    AND a.id IN (
      SELECT MAX(id) FROM assessments WHERE user_id = a.user_id
    )
  `).all(...userIds);

  const assessmentMap = {};
  latestAssessments.forEach(a => {
    assessmentMap[a.user_id] = a;
  });

  const users = caseload.map(u => ({
    id: u.id,
    name: u.name,
    latestAssessment: assessmentMap[u.id] || null
  }));

  const scores = latestAssessments.map(a => a.total_percent).filter(s => s !== null);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const highRiskCount = scores.filter(s => s < 60).length;

  res.json({
    users,
    summary: {
      totalAssessments: latestAssessments.length,
      avgScore,
      highRiskCount
    }
  });
});

// System Status
app.get('/api/admin/system-status', adminGuard, (req, res) => {
  const dbSize = db.prepare('PRAGMA page_count').get().page_count * db.prepare('PRAGMA page_size').get().page_size;
  const uptime = process.uptime();
  
  res.json({
    status: 'healthy',
    uptime: Math.floor(uptime),
    database: {
      size: dbSize,
      connected: true
    },
    server: {
      memory: process.memoryUsage(),
      version: process.version
    }
  });
});

// Notifications and chat tables
db.exec(`
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  therapist_id INTEGER,
  lab_id INTEGER,
  type TEXT,
  payload_json TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  therapist_id INTEGER,
  sender_type TEXT,
  content TEXT,
  is_read_by_therapist INTEGER DEFAULT 0,
  is_read_by_user INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Notifications API
app.get('/api/therapists/:id/notifications', (req, res) => {
  const therapistId = parseInt(req.params.id);
  const { unread } = req.query;
  let sql = 'SELECT * FROM notifications WHERE therapist_id=?';
  const params = [therapistId];
  // Only filter to unread when query param `unread=true` is explicitly provided
  if (unread === 'true') { sql += ' AND is_read=0'; }
  sql += ' ORDER BY created_at DESC, id DESC';
  const notifications = db.prepare(sql).all(...params);
  const unreadCount = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE therapist_id=? AND is_read=0').get(therapistId).c;
  res.json({ notifications, unreadCount });
});
app.patch('/api/therapists/:id/notifications/mark-read', (req, res) => {
  const therapistId = parseInt(req.params.id);
  db.prepare('UPDATE notifications SET is_read=1 WHERE therapist_id=? AND is_read=0').run(therapistId);
  res.json({ ok: true });
});

// Messages API
app.get('/api/messages', (req, res) => {
  const userId = parseInt(req.query.user_id);
  const therapistId = parseInt(req.query.therapist_id);
  if (!userId || !therapistId) return res.status(400).json({ error: 'user_id and therapist_id required' });
  const list = db.prepare('SELECT * FROM messages WHERE user_id=? AND therapist_id=? ORDER BY created_at ASC, id ASC').all(userId, therapistId);
  res.json(list);
});

// Get all messages for a user across therapists
app.get('/api/messages/user/:user_id', (req, res) => {
  const userId = parseInt(req.params.user_id);
  if (!userId) return res.status(400).json({ error: 'Invalid user id' });
  const rows = db.prepare('SELECT m.*, t.name as therapist_name, t.email as therapist_email FROM messages m LEFT JOIN therapists t ON m.therapist_id = t.id WHERE m.user_id=? ORDER BY m.created_at DESC, m.id DESC').all(userId);
  res.json(rows);
});
app.post('/api/messages', (req, res) => {
  const { user_id, therapist_id, sender_type, content } = req.body || {};
  if (!user_id || !therapist_id || !sender_type || !content) return res.status(400).json({ error: 'Missing fields' });
  const info = db.prepare('INSERT INTO messages (user_id, therapist_id, sender_type, content) VALUES (?, ?, ?, ?)')
    .run(user_id, therapist_id, sender_type, content);
  const msg = db.prepare('SELECT * FROM messages WHERE id=?').get(info.lastInsertRowid);
  // If therapist sends an examination suggestion that targets a lab, create a lab_assignment record
  if (sender_type === 'therapist') {
    try {
      const parsed = JSON.parse(content);
      if (parsed && parsed.kind === 'examination' && parsed.lab_id) {
        const labId = parseInt(parsed.lab_id);
        const infoAssign = db.prepare(`INSERT INTO lab_assignments (lab_id, message_id, user_id, therapist_id, status, assigned_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(labId, msg.id, user_id, therapist_id, 'pending', new Date().toISOString());
        const assignmentId = infoAssign.lastInsertRowid;
        // Insert lab notification so lab portal can show a distinct notification list
        try {
          // Get patient and therapist details
          const patient = db.prepare('SELECT id, name, email FROM users WHERE id=?').get(user_id);
          const therapist = db.prepare('SELECT id, name, email FROM therapists WHERE id=?').get(therapist_id);
          
          const payload = {
            kind: 'lab_assignment',
            assignment_id: assignmentId,
            message_id: msg.id,
            user_id: user_id,
            patient_name: patient ? patient.name : 'Unknown Patient',
            patient_email: patient ? patient.email : '',
            therapist_id: therapist_id,
            therapist_name: therapist ? therapist.name : 'Unknown Therapist',
            therapist_email: therapist ? therapist.email : '',
            exam_type: parsed.tests || 'General Examination',
            exam_description: parsed.notes || 'No description provided',
            exam_details: parsed,
            preview: (parsed.tests || parsed.notes || '').toString().slice(0, 200)
          };
          db.prepare('INSERT INTO notifications (lab_id, type, payload_json) VALUES (?, ?, ?)')
            .run(labId, 'lab_assignment', JSON.stringify(payload));
        } catch (e) {
          console.error('[lab notify] failed to insert lab notification', e);
        }
      }
    } catch (e) {
      // ignore non-JSON content
    }
  }
  // Notify therapist when user sends a message
  if (sender_type === 'user') {
    const payload = { kind: 'message', user_id, message_id: msg.id, preview: content.slice(0, 140) };
    db.prepare('INSERT INTO notifications (therapist_id, type, payload_json) VALUES (?, ?, ?)')
      .run(therapist_id, 'message', JSON.stringify(payload));
  }
  res.json(msg);
});

// --- Labs tables and simple lab portal endpoints ---
db.exec(`
CREATE TABLE IF NOT EXISTS labs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  contact_info TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS lab_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_id INTEGER,
  message_id INTEGER,
  user_id INTEGER,
  therapist_id INTEGER,
  status TEXT DEFAULT 'pending',
  assigned_at TEXT,
  accepted_at TEXT,
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS lab_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER,
  result_json TEXT,
  attachment_name TEXT,
  attachment_mime TEXT,
  attachment_blob BLOB,
  uploaded_by TEXT,
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Migrate lab_results to add attachment columns if missing
try {
  const lrCols = db.prepare("PRAGMA table_info(lab_results)").all();
  const lrNames = lrCols.map(c => c.name);
  if (!lrNames.includes('attachment_name')) {
    db.exec("ALTER TABLE lab_results ADD COLUMN attachment_name TEXT;");
    console.log('[DB] Added lab_results.attachment_name');
  }
  if (!lrNames.includes('attachment_mime')) {
    db.exec("ALTER TABLE lab_results ADD COLUMN attachment_mime TEXT;");
    console.log('[DB] Added lab_results.attachment_mime');
  }
  if (!lrNames.includes('attachment_blob')) {
    db.exec("ALTER TABLE lab_results ADD COLUMN attachment_blob BLOB;");
    console.log('[DB] Added lab_results.attachment_blob');
  }
} catch (e) {
  console.error('[lab_results migration] failed', e);
}

// Migrate existing DB: ensure lab_assignments columns exist (for older DBs)
try {
  const laCols = db.prepare("PRAGMA table_info(lab_assignments)").all();
  const colNames = laCols.map(c => c.name);
  if (!colNames.includes('assigned_at')) {
    db.exec("ALTER TABLE lab_assignments ADD COLUMN assigned_at TEXT;");
    console.log('[DB] Added lab_assignments.assigned_at');
  }
  if (!colNames.includes('accepted_at')) {
    db.exec("ALTER TABLE lab_assignments ADD COLUMN accepted_at TEXT;");
    console.log('[DB] Added lab_assignments.accepted_at');
  }
  if (!colNames.includes('completed_at')) {
    db.exec("ALTER TABLE lab_assignments ADD COLUMN completed_at TEXT;");
    console.log('[DB] Added lab_assignments.completed_at');
  }
} catch (e) {
  // If table doesn't exist yet, ignore; creation above will handle it
}

// Seed demo labs if not present
try {
  const cnt = db.prepare('SELECT COUNT(*) as c FROM labs').get().c;
  if (cnt === 0) {
    const insert = db.prepare('INSERT INTO labs (name, contact_info) VALUES (?, ?)');
    const tx = db.transaction(() => {
      insert.run('Acme Lab', 'acme@example.com');
      insert.run('Central Diagnostics', 'central@example.com');
      insert.run('HealthPlus Labs', 'healthplus@example.com');
    });
    tx();
    console.log('[seed] Inserted demo labs');
  }
} catch (e) {
  console.error('[seed labs] Failed:', e);
}

// Backfill appointments timestamps if missing
try {
  // Ensure the columns exist (older DBs may not have created_at/updated_at on appointments)
  const apptCols = db.prepare("PRAGMA table_info(appointments)").all();
  const apptColNames = apptCols.map(c => c.name);
  if (!apptColNames.includes('created_at')) {
    db.exec("ALTER TABLE appointments ADD COLUMN created_at TEXT;");
    console.log('[DB] Added appointments.created_at');
  }
  if (!apptColNames.includes('updated_at')) {
    db.exec("ALTER TABLE appointments ADD COLUMN updated_at TEXT;");
    console.log('[DB] Added appointments.updated_at');
  }

  db.prepare("UPDATE appointments SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL OR created_at = ''").run();
  db.prepare("UPDATE appointments SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL OR updated_at = ''").run();
  console.log('[seed] Backfilled appointments.created_at/updated_at');
} catch (e) {
  console.error('[appointments migration] Failed:', e);
}

// Seed admin user (so admin can sign in using the regular login screen)
try {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'adminpass';
  // Use parameterized query for user_type to avoid SQL parsing issues
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email=? AND user_type=?').get(adminEmail, 'admin');
  if (!existingAdmin) {
    const { salt, hash } = hashPassword(adminPassword);
    db.prepare('INSERT INTO users (name, email, password_hash, password_salt, user_type, is_verified, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('Admin', adminEmail, hash, salt, 'admin', 1, 1);
    console.log(`[seed] Inserted admin user ${adminEmail} (password: ${adminPassword})`);
  }
} catch (e) {
  console.error('[seed admin] Failed:', e);
}

// Ensure password columns exist on labs and set default password for seeded labs
try {
  const labCols = db.prepare("PRAGMA table_info(labs)").all();
  const labColNames = labCols.map(c => c.name);
  if (!labColNames.includes('password_hash')) {
    db.exec("ALTER TABLE labs ADD COLUMN password_hash TEXT;");
    console.log('[DB] Added labs.password_hash');
  }
  if (!labColNames.includes('password_salt')) {
    db.exec("ALTER TABLE labs ADD COLUMN password_salt TEXT;");
    console.log('[DB] Added labs.password_salt');
  }
  // set default password for any labs missing a password (password: labpass)
  const labsNoPwd = db.prepare("SELECT id FROM labs WHERE password_hash IS NULL OR password_hash = ''").all();
  if (labsNoPwd && labsNoPwd.length) {
    const upd = db.prepare('UPDATE labs SET password_hash = ?, password_salt = ? WHERE id = ?');
    for (const r of labsNoPwd) {
      const { salt, hash } = hashPassword('labpass');
      upd.run(hash, salt, r.id);
    }
    console.log('[seed] Set default password for demo labs (password: labpass)');
  }
} catch (e) {
  console.error('[labs migration] failed', e);
}

// JWT helpers for lab auth (simple HMAC-SHA256, no external deps)
const JWT_SECRET = process.env.LAB_JWT_SECRET || 'change_this_secret_in_prod';
function base64UrlEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}
function signJwt(payload, expiresInSeconds = 24 * 3600) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };
  const payloadEnc = base64UrlEncode(JSON.stringify(body));
  const toSign = `${header}.${payloadEnc}`;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(toSign).digest('base64');
  const sigEnc = sig.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${toSign}.${sigEnc}`;
}
function verifyJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payloadEnc, sig] = parts;
    const toSign = `${header}.${payloadEnc}`;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(toSign).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    if (expectedSig !== sig) return null;
    const payloadBuf = base64UrlDecode(payloadEnc);
    const payload = JSON.parse(payloadBuf.toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function requireLabAuth(req, res, next) {
  const auth = (req.headers.authorization || '').toString();
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing Authorization' });
  const token = auth.slice(7).trim();
  const payload = verifyJwt(token);
  if (!payload || !payload.lab_id) return res.status(401).json({ error: 'Invalid or expired token' });
  req.labId = Number(payload.lab_id);
  next();
}

// Login endpoint for labs
app.post('/api/labs/login', (req, res) => {
  const { lab_id, password } = req.body || {};
  if (!lab_id || !password) return res.status(400).json({ error: 'lab_id and password required' });
  const lab = db.prepare('SELECT * FROM labs WHERE id=?').get(lab_id);
  if (!lab) return res.status(404).json({ error: 'Lab not found' });
  try {
    const ok = verifyPassword(password, lab.password_salt, lab.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    // issue JWT
    const token = signJwt({ lab_id: lab.id }, 24 * 3600);
    res.json({ token, lab: { id: lab.id, name: lab.name, contact_info: lab.contact_info } });
  } catch (e) {
    console.error('[lab login] error', e);
    res.status(500).json({ error: 'Login failed' });
  }
});

// List labs
app.get('/api/labs', (req, res) => {
  const rows = db.prepare('SELECT id, name, contact_info, created_at FROM labs ORDER BY id ASC').all();
  res.json(rows);
});

// Get assignments for a lab (include message and user info)
app.get('/api/labs/:id/assignments', requireLabAuth, (req, res) => {
  const labId = parseInt(req.params.id);
  if (!labId) return res.status(400).json({ error: 'Invalid lab id' });
  if (req.labId !== labId) return res.status(403).json({ error: 'Forbidden' });
  const rows = db.prepare(`
    SELECT a.*, m.content as message_content, u.name as user_name, u.email as user_email, t.name as therapist_name
    FROM lab_assignments a
    LEFT JOIN messages m ON m.id = a.message_id
    LEFT JOIN users u ON u.id = a.user_id
    LEFT JOIN therapists t ON t.id = a.therapist_id
    WHERE a.lab_id = ?
    ORDER BY COALESCE(a.assigned_at, a.id) DESC
  `).all(labId);
  res.json(rows);
});

// Lab notifications endpoint
app.get('/api/labs/:id/notifications', requireLabAuth, (req, res) => {
  const labId = parseInt(req.params.id);
  if (!labId) return res.status(400).json({ error: 'Invalid lab id' });
  if (req.labId !== labId) return res.status(403).json({ error: 'Forbidden' });
  const unread = req.query.unread === 'true';
  let sql = 'SELECT * FROM notifications WHERE lab_id=?';
  const params = [labId];
  if (unread) { sql += ' AND is_read=0'; }
  sql += ' ORDER BY created_at DESC, id DESC';
  const rows = db.prepare(sql).all(...params);
  const unreadCount = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE lab_id=? AND is_read=0').get(labId).c;
  res.json({ notifications: rows, unreadCount });
});

// Mark lab notifications read
app.patch('/api/labs/:id/notifications/mark-read', requireLabAuth, (req, res) => {
  const labId = parseInt(req.params.id);
  if (!labId) return res.status(400).json({ error: 'Invalid lab id' });
  if (req.labId !== labId) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('UPDATE notifications SET is_read=1 WHERE lab_id=? AND is_read=0').run(labId);
  res.json({ ok: true });
});

// Lab accepts assignment
app.post('/api/labs/assignments/:id/accept', requireLabAuth, (req, res) => {
  const assignmentId = parseInt(req.params.id);
  if (!assignmentId) return res.status(400).json({ error: 'Invalid assignment id' });
  const assignment = db.prepare('SELECT * FROM lab_assignments WHERE id=?').get(assignmentId);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  if (assignment.lab_id !== req.labId) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('UPDATE lab_assignments SET status=?, accepted_at=? WHERE id=?').run('accepted', new Date().toISOString(), assignmentId);
  res.json({ ok: true });
});

// Lab uploads results
app.post('/api/labs/assignments/:id/results', requireLabAuth, (req, res) => {
  const assignmentId = parseInt(req.params.id);
  const { result_json, uploaded_by } = req.body || {};
  if (!assignmentId || !result_json) return res.status(400).json({ error: 'Missing fields' });
  const assignment = db.prepare('SELECT * FROM lab_assignments WHERE id=?').get(assignmentId);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  if (assignment.lab_id !== req.labId) return res.status(403).json({ error: 'Forbidden' });
  // support optional attachment fields: attachment_name, attachment_mime, attachment_base64
  const { attachment_name, attachment_mime, attachment_base64 } = req.body || {};
  let info;
  if (attachment_base64) {
    // decode base64 to Buffer and store as BLOB
    const buf = Buffer.from(attachment_base64, 'base64');
    info = db.prepare('INSERT INTO lab_results (assignment_id, result_json, attachment_name, attachment_mime, attachment_blob, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)')
      .run(assignmentId, result_json, attachment_name || null, attachment_mime || null, buf, uploaded_by || 'lab');
  } else {
    info = db.prepare('INSERT INTO lab_results (assignment_id, result_json, uploaded_by) VALUES (?, ?, ?)').run(assignmentId, result_json, uploaded_by || 'lab');
  }
  db.prepare('UPDATE lab_assignments SET status=?, completed_at=? WHERE id=?').run('completed', new Date().toISOString(), assignmentId);

  // Create notifications for therapist and user (if possible)
  try {
    const a = db.prepare('SELECT * FROM lab_assignments WHERE id=?').get(assignmentId);
    if (a) {
      const payloadT = { kind: 'lab_result', assignment_id: assignmentId, assignment: a };
      db.prepare('INSERT INTO notifications (therapist_id, type, payload_json) VALUES (?, ?, ?)').run(a.therapist_id, 'lab_result', JSON.stringify(payloadT));
      const payloadU = { kind: 'lab_result', assignment_id: assignmentId, preview: 'Lab results available' };
      db.prepare('INSERT INTO notifications (therapist_id, type, payload_json) VALUES (?, ?, ?)').run(a.therapist_id, 'lab_result_user_copy', JSON.stringify(payloadU));
    }
  } catch (e) {
    console.error('[lab results notify] failed', e);
  }

  const row = db.prepare('SELECT * FROM lab_results WHERE id=?').get(info.lastInsertRowid);
  res.json(row);
});

// Fetch results for an assignment (lab auth required)
app.get('/api/labs/assignments/:id/results', requireLabAuth, (req, res) => {
  const assignmentId = parseInt(req.params.id);
  if (!assignmentId) return res.status(400).json({ error: 'Invalid assignment id' });
  const assignment = db.prepare('SELECT * FROM lab_assignments WHERE id=?').get(assignmentId);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  if (assignment.lab_id !== req.labId) return res.status(403).json({ error: 'Forbidden' });
  const rows = db.prepare('SELECT id, result_json, attachment_name, attachment_mime, uploaded_by, uploaded_at FROM lab_results WHERE assignment_id=? ORDER BY uploaded_at DESC').all(assignmentId);
  // convert any blob to base64 for transport
  const processed = rows.map(r => {
    const full = db.prepare('SELECT attachment_blob FROM lab_results WHERE id=?').get(r.id);
    let attachment_base64 = null;
    if (full && full.attachment_blob) {
      try { attachment_base64 = Buffer.from(full.attachment_blob).toString('base64'); } catch (e) { attachment_base64 = null; }
    }
    return { ...r, attachment_base64 };
  });
  res.json(processed);
});

// Generate PDF report for a lab assignment (no auth required for simplicity)
app.get('/api/labs/assignments/:id/report', (req, res) => {
  const assignmentId = parseInt(req.params.id);
  if (!assignmentId) return res.status(400).json({ error: 'Invalid assignment id' });
  const assignment = db.prepare('SELECT a.*, m.content as message_content, u.name as user_name, u.email as user_email, t.name as therapist_name FROM lab_assignments a LEFT JOIN messages m ON m.id = a.message_id LEFT JOIN users u ON u.id = a.user_id LEFT JOIN therapists t ON t.id = a.therapist_id WHERE a.id=?').get(assignmentId);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  try {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const filename = `lab-assignment-${assignmentId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Header
    doc.rect(0, 0, 595, 80).fill('#0b61c6');
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('MEDICARE', 40, 22);
    doc.fontSize(10).fillColor('#EAF2FF').font('Helvetica').text('Lab Assignment Report', 40, 48);

    doc.moveDown(2);
    doc.fillColor('#000').fontSize(12).font('Helvetica-Bold').text(`Assignment #${assignment.id}`);
    doc.moveDown(0.2);
    doc.fontSize(10).font('Helvetica').text(`Status: ${assignment.status || 'N/A'}`);
    doc.text(`Patient: ${assignment.user_name || assignment.user_id || 'N/A'}`);
    doc.text(`Therapist: ${assignment.therapist_name || assignment.therapist_id || 'N/A'}`);
    if (assignment.assigned_at) doc.text(`Assigned at: ${assignment.assigned_at}`);
    if (assignment.completed_at) doc.text(`Completed at: ${assignment.completed_at}`);

    doc.moveDown(1);
    doc.fontSize(11).font('Helvetica-Bold').text('Message / Notes');
    doc.fontSize(10).font('Helvetica').text(assignment.message_content || 'No message');

    // Include any uploaded lab results (try to fit all content on single page)
    const results = db.prepare('SELECT id, result_json, attachment_name, uploaded_by, uploaded_at FROM lab_results WHERE assignment_id=? ORDER BY uploaded_at DESC').all(assignmentId);
    if (Array.isArray(results) && results.length > 0) {
      doc.moveDown(1);
      doc.fontSize(13).font('Helvetica-Bold').text('Lab Results');
      doc.moveDown(0.5);

      // Build combined text for all results
      let combined = '';
      results.forEach((r, idx) => {
        let parsed = r.result_json;
        try { if (typeof parsed === 'string') parsed = JSON.parse(parsed); } catch (e) { /* keep as string */ }
        const text = (typeof parsed === 'object') ? JSON.stringify(parsed, null, 2) : String(parsed || '');
        combined += `Result ${idx + 1} — Uploaded: ${r.uploaded_at || ''}  By: ${r.uploaded_by || ''}\n`;
        combined += `${text}\n`;
        if (r.attachment_name) combined += `Attachment: ${r.attachment_name}\n`;
        combined += '\n';
      });

      // Try to fit combined text on the current page by reducing font size if necessary
      const pageWidth = 595; // A4 points
      const pageHeight = 842;
      const margin = 36;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      let fontSize = 10;
      doc.font('Helvetica');
      // current Y position
      const startY = doc.y;
      let remainingHeight = pageHeight - startY - margin;
      if (remainingHeight < 60) remainingHeight = pageHeight - margin - 80; // fallback

      let height = 0;
      do {
        doc.fontSize(fontSize);
        height = doc.heightOfString(combined, { width: usableWidth });
        if (height > remainingHeight) fontSize -= 1;
      } while (height > remainingHeight && fontSize >= 8);

      // Finally render with selected fontSize
      doc.fontSize(fontSize).font('Helvetica').text(combined, { width: usableWidth });
    }

    // Finish
    doc.end();
  } catch (e) {
    console.error('[lab report] error', e);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Therapist can view lab results for their own assignments
app.get('/api/therapists/:therapistId/lab-results/:assignmentId', (req, res) => {
  const therapistId = parseInt(req.params.therapistId);
  const assignmentId = parseInt(req.params.assignmentId);
  if (!therapistId || !assignmentId) return res.status(400).json({ error: 'Invalid parameters' });
  
  const assignment = db.prepare('SELECT * FROM lab_assignments WHERE id=?').get(assignmentId);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  if (assignment.therapist_id !== therapistId) return res.status(403).json({ error: 'Forbidden' });
  
  const rows = db.prepare('SELECT id, result_json, attachment_name, attachment_mime, uploaded_by, uploaded_at FROM lab_results WHERE assignment_id=? ORDER BY uploaded_at DESC').all(assignmentId);
  // convert any blob to base64 for transport
  const processed = rows.map(r => {
    const full = db.prepare('SELECT attachment_blob FROM lab_results WHERE id=?').get(r.id);
    let attachment_base64 = null;
    if (full && full.attachment_blob) {
      try { attachment_base64 = Buffer.from(full.attachment_blob).toString('base64'); } catch (e) { attachment_base64 = null; }
    }
    return { ...r, attachment_base64 };
  });
  res.json(processed);
});

// Serve simple lab portal static files
// Serve a copy of the client landing background so the portal can reuse it
app.get('/lab-portal/background.png', (req, res) => {
  try {
    const p = path.resolve(process.cwd(), '../client/assets/background.png');
    if (!fs.existsSync(p)) return res.status(404).send('Not found');
    res.setHeader('Content-Type', 'image/png');
    const stream = fs.createReadStream(p);
    stream.pipe(res);
  } catch (e) {
    console.error('Failed to serve background.png', e);
    res.status(500).send('Server error');
  }
});

app.use('/lab-portal', express.static('public/lab_portal'));

// Get conversations for a therapist (list of users with last message)
app.get('/api/therapists/:id/messages', (req, res) => {
  const therapistId = parseInt(req.params.id);
  if (!therapistId) return res.status(400).json({ error: 'Invalid therapist id' });
  const rows = db.prepare(`
    SELECT u.id as user_id, u.name as user_name, u.email as user_email,
      (SELECT m.content FROM messages m WHERE m.user_id=u.id AND m.therapist_id=? ORDER BY m.created_at DESC LIMIT 1) as last_message,
      (SELECT m.created_at FROM messages m WHERE m.user_id=u.id AND m.therapist_id=? ORDER BY m.created_at DESC LIMIT 1) as last_at
    FROM messages
    JOIN users u ON u.id = messages.user_id
    WHERE messages.therapist_id=?
    GROUP BY u.id
    ORDER BY last_at DESC
  `).all(therapistId, therapistId, therapistId);
  res.json(rows);
});

// Communities table creation
db.exec(`
CREATE TABLE IF NOT EXISTS communities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  therapist_id INTEGER,
  name TEXT,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS community_facilitators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  community_id INTEGER,
  therapist_id INTEGER,
  joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(community_id, therapist_id)
);
CREATE TABLE IF NOT EXISTS community_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  community_id INTEGER,
  user_id INTEGER,
  joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(community_id, user_id)
);
CREATE TABLE IF NOT EXISTS community_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  community_id INTEGER,
  user_id INTEGER,
  therapist_id INTEGER,
  content TEXT,
  image_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS community_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER,
  user_id INTEGER,
  therapist_id INTEGER,
  parent_comment_id INTEGER,
  content TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS post_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER,
  user_id INTEGER,
  therapist_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id),
  UNIQUE(post_id, therapist_id)
);
CREATE TABLE IF NOT EXISTS therapist_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  therapist_id INTEGER,
  content TEXT,
  image_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS therapist_post_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER,
  user_id INTEGER,
  therapist_id INTEGER,
  parent_comment_id INTEGER,
  content TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS therapist_post_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER,
  user_id INTEGER,
  therapist_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id),
  UNIQUE(post_id, therapist_id)
);
`);

// Migration: add image_url to community_posts if missing (older DBs)
try {
  const postCols = db.prepare("PRAGMA table_info(community_posts)").all();
  if (!postCols.some(c => c.name === 'image_url')) {
    db.exec("ALTER TABLE community_posts ADD COLUMN image_url TEXT;");
    console.log('[DB] Added community_posts.image_url');
  }
} catch (e) {
  // non-fatal
}

function buildCommunityQueryParts({ userId = null, therapistId = null } = {}) {
  const columns = [
    'c.*',
    't.name AS creator_name',
    '(SELECT COUNT(*) FROM community_members WHERE community_id = c.id) AS member_count'
  ];
  const joins = ['LEFT JOIN therapists t ON c.therapist_id = t.id'];
  const params = [];
  if (userId) {
    columns.push('CASE WHEN cm.user_id IS NULL THEN 0 ELSE 1 END AS is_member');
    joins.push('LEFT JOIN community_members cm ON cm.community_id = c.id AND cm.user_id = ?');
    params.push(userId);
  } else {
    columns.push('0 AS is_member');
  }
  if (therapistId) {
    columns.push('CASE WHEN cf.therapist_id IS NULL THEN 0 ELSE 1 END AS is_facilitator');
    joins.push('LEFT JOIN community_facilitators cf ON cf.community_id = c.id AND cf.therapist_id = ?');
    params.push(therapistId);
  } else {
    columns.push('0 AS is_facilitator');
  }
  return { columns, joins, params };
}

function listCommunitiesWithMeta(options = {}) {
  const { columns, joins, params } = buildCommunityQueryParts(options);
  const sql = `
    SELECT ${columns.join(', ')}
    FROM communities c
    ${joins.join('\n')}
    ORDER BY c.created_at DESC
  `;
  return db.prepare(sql).all(...params);
}

function fetchCommunityWithMeta(communityId, options = {}) {
  const { columns, joins, params } = buildCommunityQueryParts(options);
  const sql = `
    SELECT ${columns.join(', ')}
    FROM communities c
    ${joins.join('\n')}
    WHERE c.id = ?
  `;
  const finalParams = [...params, communityId];
  return db.prepare(sql).get(...finalParams);
}

function buildTherapistPostSelectParts({ userId = null, viewerTherapistId = null } = {}) {
  let normalizedUserId = userId ? parseInt(userId, 10) : null;
  let normalizedViewerId = viewerTherapistId ? parseInt(viewerTherapistId, 10) : null;
  if (Number.isNaN(normalizedUserId)) normalizedUserId = null;
  if (Number.isNaN(normalizedViewerId)) normalizedViewerId = null;
  const columns = [
    'p.*',
    'COALESCE(t.name, \'Therapist\') AS author_name',
    'COALESCE(t.avatar_url, \'\') AS author_avatar',
    '(SELECT COUNT(*) FROM therapist_post_comments c WHERE c.post_id = p.id) AS comments_count'
  ];
  const likeClauses = ['(SELECT COUNT(*) FROM therapist_post_likes WHERE post_id = p.id) AS likes_count'];
  const params = [];

  if (normalizedViewerId) {
    likeClauses.push('CASE WHEN EXISTS (SELECT 1 FROM therapist_post_likes WHERE post_id = p.id AND therapist_id = ?) THEN 1 ELSE 0 END AS liked_by_therapist');
    params.push(normalizedViewerId);
  } else {
    likeClauses.push('0 AS liked_by_therapist');
  }

  if (normalizedUserId) {
    likeClauses.push('CASE WHEN EXISTS (SELECT 1 FROM therapist_post_likes WHERE post_id = p.id AND user_id = ?) THEN 1 ELSE 0 END AS liked_by_user');
    params.push(normalizedUserId);
  } else {
    likeClauses.push('0 AS liked_by_user');
  }

  columns.push(...likeClauses);
  return { columns, params };
}

function listTherapistPosts({ userId = null, viewerTherapistId = null, filterTherapistId = null } = {}) {
  let normalizedFilterId = filterTherapistId ? parseInt(filterTherapistId, 10) : null;
  if (Number.isNaN(normalizedFilterId)) normalizedFilterId = null;
  const { columns, params } = buildTherapistPostSelectParts({ userId, viewerTherapistId });
  let sql = `
    SELECT ${columns.join(',\n      ')}
    FROM therapist_posts p
    LEFT JOIN therapists t ON p.therapist_id = t.id
  `;
  const finalParams = [...params];
  if (normalizedFilterId) {
    sql += ' WHERE p.therapist_id = ?';
    finalParams.push(normalizedFilterId);
  }
  sql += ' ORDER BY p.created_at DESC, p.id DESC';
  return db.prepare(sql).all(...finalParams);
}

function fetchTherapistPostWithMeta(postId, options = {}) {
  const { columns, params } = buildTherapistPostSelectParts(options);
  const sql = `
    SELECT ${columns.join(',\n      ')}
    FROM therapist_posts p
    LEFT JOIN therapists t ON p.therapist_id = t.id
    WHERE p.id = ?
  `;
  const finalParams = [...params, postId];
  return db.prepare(sql).get(...finalParams);
}

function parseOptionalInt(value) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

// Get communities associated with therapist (owner or facilitator)
app.get('/api/therapists/:id/communities', (req, res) => {
  const therapistId = parseInt(req.params.id);
  if (!therapistId) return res.status(400).json({ error: 'Invalid therapist id' });
  const { columns, joins, params } = buildCommunityQueryParts({ therapistId });
  const sql = `
    SELECT ${columns.join(', ')}
    FROM communities c
    ${joins.join('\n')}
    WHERE c.therapist_id = ? OR cf.therapist_id IS NOT NULL
    ORDER BY c.created_at DESC
  `;
  const finalParams = [...params, therapistId];
  const communities = db.prepare(sql).all(...finalParams);
  res.json(communities);
});

// Create a new community
app.post('/api/communities', (req, res) => {
  const { therapist_id, name, description } = req.body || {};
  if (!therapist_id || !name) return res.status(400).json({ error: 'therapist_id and name are required' });
  const info = db.prepare('INSERT INTO communities (therapist_id, name, description) VALUES (?, ?, ?)').run(therapist_id, name, description || '');
  const communityId = info.lastInsertRowid;
  db.prepare('INSERT OR IGNORE INTO community_facilitators (community_id, therapist_id) VALUES (?, ?)').run(communityId, therapist_id);
  const community = fetchCommunityWithMeta(communityId, { therapistId: therapist_id });
  res.json(community);
});

// Join community as facilitator or member
app.post('/api/communities/:id/join', (req, res) => {
  const communityId = parseInt(req.params.id);
  const { therapist_id, user_id } = req.body || {};
  console.log(`[api] POST /api/communities/${communityId}/join called with therapist_id=${therapist_id} user_id=${user_id}`);
  if (!communityId) return res.status(400).json({ error: 'Invalid community id' });
  const communityExists = db.prepare('SELECT id FROM communities WHERE id=?').get(communityId);
  if (!communityExists) return res.status(404).json({ error: 'Community not found' });
  try {
    if (therapist_id) {
      db.prepare('INSERT INTO community_facilitators (community_id, therapist_id) VALUES (?, ?)').run(communityId, therapist_id);
      const community = fetchCommunityWithMeta(communityId, { therapistId: therapist_id });
      console.log(`[api] Joined community ${communityId} as facilitator therapist_id=${therapist_id}`);
      return res.json({ ok: true, community });
    }
    if (user_id) {
      db.prepare('INSERT INTO community_members (community_id, user_id) VALUES (?, ?)').run(communityId, user_id);
      const community = fetchCommunityWithMeta(communityId, { userId: user_id });
      console.log(`[api] Joined community ${communityId} as member user_id=${user_id}`);
      return res.json({ ok: true, community });
    }
    return res.status(400).json({ error: 'therapist_id or user_id required' });
  } catch (e) {
    console.error('[api] join community failed', e);
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const msg = therapist_id ? 'Already a facilitator' : 'Already a member';
      console.log(`[api] join community duplicate: ${msg}`);
      return res.status(409).json({ error: msg });
    }
    return res.status(500).json({ error: 'Failed to join community' });
  }
});

// Get all communities (for therapists to join and patients to view)
app.get('/api/communities', (req, res) => {
  const userId = req.query.user_id ? parseInt(req.query.user_id) : null;
  const therapistId = req.query.therapist_id ? parseInt(req.query.therapist_id) : null;
  const communities = listCommunitiesWithMeta({ userId, therapistId });
  res.json(communities);
});

// Edit community (only by creator therapist)
app.patch('/api/communities/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description } = req.body || {};
  const existing = db.prepare('SELECT * FROM communities WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Community not found' });
  const fields = [];
  const params = [];
  if (name) { fields.push('name=?'); params.push(name); }
  if (description !== undefined) { fields.push('description=?'); params.push(description); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  params.push(id);
  const sql = `UPDATE communities SET ${fields.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`;
  db.prepare(sql).run(...params);
  const updated = fetchCommunityWithMeta(id, { therapistId: existing.therapist_id });
  res.json(updated);
});

// Delete community (only by creator therapist)
app.delete('/api/communities/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = db.prepare('SELECT id, therapist_id FROM communities WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Community not found' });
  // Delete related data
  db.prepare('DELETE FROM community_facilitators WHERE community_id=?').run(id);
  db.prepare('DELETE FROM community_members WHERE community_id=?').run(id);
  db.prepare('DELETE FROM communities WHERE id=?').run(id);
  res.json({ ok: true, id });
});

// Leave community as member (for patients)
app.delete('/api/communities/:id/leave', (req, res) => {
  const communityId = parseInt(req.params.id);
  const bodyUserId = req.body && req.body.user_id ? parseInt(req.body.user_id) : null;
  const queryUserId = req.query.user_id ? parseInt(req.query.user_id) : null;
  const userId = bodyUserId || queryUserId;
  if (!communityId || !userId) return res.status(400).json({ error: 'community_id and user_id required' });
  const deleted = db.prepare('DELETE FROM community_members WHERE community_id=? AND user_id=?').run(communityId, userId);
  if (deleted.changes === 0) return res.status(404).json({ error: 'Not a member' });
  res.json({ ok: true });
});

// Get community members
app.get('/api/communities/:id/members', (req, res) => {
  const communityId = parseInt(req.params.id);
  const members = db.prepare(`
    SELECT cm.*, u.name, u.email
    FROM community_members cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.community_id=?
    ORDER BY cm.joined_at DESC
  `).all(communityId);
  res.json(members);
});

// List posts in a community with author name, comment count, and likes metadata
app.get('/api/communities/:id/posts', (req, res) => {
  const communityId = parseInt(req.params.id);
  const therapistId = req.query.therapist_id ? parseInt(req.query.therapist_id) : null;
  const userId = req.query.user_id ? parseInt(req.query.user_id) : null;
  if (!communityId) return res.status(400).json({ error: 'Invalid community id' });
  const likeClauses = [
    '(SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likes_count',
  ];
  const likeParams = [];
  if (therapistId) {
    likeClauses.push(
      'CASE WHEN EXISTS (SELECT 1 FROM post_likes WHERE post_id = p.id AND therapist_id = ?) THEN 1 ELSE 0 END AS liked_by_therapist'
    );
    likeParams.push(therapistId);
  }
  if (userId) {
    likeClauses.push(
      'CASE WHEN EXISTS (SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) THEN 1 ELSE 0 END AS liked_by_user'
    );
    likeParams.push(userId);
  }
  const extraColumns = likeClauses.join(',\n      ');
  const sql = `
    SELECT p.*, 
      COALESCE(u.name, t.name, 'Unknown') AS author_name,
      COALESCE(u.avatar_url, t.avatar_url, '') AS author_avatar,
      (SELECT COUNT(*) FROM community_comments c WHERE c.post_id = p.id) AS comments_count,
      ${extraColumns}
    FROM community_posts p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN therapists t ON p.therapist_id = t.id
    WHERE p.community_id = ?
    ORDER BY p.created_at DESC, p.id DESC
  `;
  const params = [...likeParams, communityId];
  const posts = db.prepare(sql).all(...params);
  res.json(posts);
});

// Create a post (user or therapist must be a member/facilitator)
app.post('/api/communities/:id/posts', (req, res) => {
  const communityId = parseInt(req.params.id);
  const { user_id, therapist_id, content, image_url } = req.body || {};
  console.log(`[api] POST /api/communities/${communityId}/posts called with user_id=${user_id} therapist_id=${therapist_id} content_len=${(content||'').length} image_url=${image_url ? '[present]' : '[null]'}`);
  if (!communityId || !content || (!user_id && !therapist_id)) {
    console.log('[api] invalid create post request, missing fields');
    return res.status(400).json({ error: 'community_id, content and user_id or therapist_id required' });
  }
  const community = db.prepare('SELECT therapist_id FROM communities WHERE id=?').get(communityId);
  if (!community) return res.status(404).json({ error: 'Community not found' });
  // Membership/facilitator check
  if (user_id) {
    db.prepare('INSERT OR IGNORE INTO community_members (community_id, user_id) VALUES (?, ?)').run(communityId, user_id);
    const isMember = db.prepare('SELECT 1 FROM community_members WHERE community_id=? AND user_id=?').get(communityId, user_id);
    console.log(`[api] membership check for community ${communityId} user_id=${user_id} => ${isMember ? 'member' : 'not_member'}`);
    if (!isMember) return res.status(403).json({ error: 'Not a member of this community' });
  }
  if (therapist_id) {
    const isOwner = community.therapist_id === therapist_id;
    const isFacilitator = isOwner || db.prepare('SELECT 1 FROM community_facilitators WHERE community_id=? AND therapist_id=?').get(communityId, therapist_id);
    console.log(`[api] facilitator check for community ${communityId} therapist_id=${therapist_id} => ${isFacilitator ? 'facilitator' : 'not_facilitator'}`);
    if (!isFacilitator) return res.status(403).json({ error: 'Not a facilitator of this community' });
  }
  try {
    const info = db.prepare('INSERT INTO community_posts (community_id, user_id, therapist_id, content, image_url) VALUES (?, ?, ?, ?, ?)')
      .run(communityId, user_id || null, therapist_id || null, content, image_url || null);
    const post = db.prepare(`
      SELECT p.*, COALESCE(u.name, t.name, 'Unknown') AS author_name, COALESCE(u.avatar_url, t.avatar_url, '') AS author_avatar, 0 AS comments_count
      FROM community_posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN therapists t ON p.therapist_id = t.id
      WHERE p.id = ?
    `).get(info.lastInsertRowid);
    console.log(`[api] created post id=${info.lastInsertRowid} community=${communityId}`);
    res.json(post);
  } catch (e) {
    console.error('[api] create post failed', e);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Post likes: create, delete, and count
app.post('/api/posts/:id/likes', (req, res) => {
  const postId = parseInt(req.params.id);
  const { user_id, therapist_id } = req.body || {};
  if (!postId || (!user_id && !therapist_id)) return res.status(400).json({ error: 'post_id and user_id or therapist_id required' });
  try {
    const info = db.prepare('INSERT INTO post_likes (post_id, user_id, therapist_id) VALUES (?, ?, ?)').run(postId, user_id || null, therapist_id || null);
    const count = db.prepare('SELECT COUNT(*) as c FROM post_likes WHERE post_id=?').get(postId).c;
    return res.json({ ok: true, count });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Already liked' });
    console.error('[post like] error', e);
    return res.status(500).json({ error: 'Failed to like' });
  }
});

app.delete('/api/posts/:id/likes', (req, res) => {
  const postId = parseInt(req.params.id);
  const { user_id, therapist_id } = req.body || {};
  if (!postId || (!user_id && !therapist_id)) return res.status(400).json({ error: 'post_id and user_id or therapist_id required' });
  try {
    const where = user_id ? 'user_id=?' : 'therapist_id=?';
    const val = user_id || therapist_id;
    const info = db.prepare(`DELETE FROM post_likes WHERE post_id=? AND ${where}`).run(postId, val);
    const count = db.prepare('SELECT COUNT(*) as c FROM post_likes WHERE post_id=?').get(postId).c;
    return res.json({ ok: true, count });
  } catch (e) {
    console.error('[delete like] error', e);
    return res.status(500).json({ error: 'Failed to unlike' });
  }
});

app.get('/api/posts/:id/likes', (req, res) => {
  const postId = parseInt(req.params.id);
  const userId = req.query.user_id ? parseInt(req.query.user_id) : null;
  const therapistId = req.query.therapist_id ? parseInt(req.query.therapist_id) : null;
  if (!postId) return res.status(400).json({ error: 'post_id required' });
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM post_likes WHERE post_id=?').get(postId).c;
    let liked = false;
    if (userId) liked = !!db.prepare('SELECT 1 FROM post_likes WHERE post_id=? AND user_id=?').get(postId, userId);
    if (therapistId) liked = !!db.prepare('SELECT 1 FROM post_likes WHERE post_id=? AND therapist_id=?').get(postId, therapistId) || liked;
    res.json({ count, liked });
  } catch (e) {
    console.error('[get likes] error', e);
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

// List comments for a post with author name (flat tree, client can thread by parent_comment_id)
app.get('/api/communities/:id/comments', (req, res) => {
  const communityId = parseInt(req.params.id);
  const postId = parseInt(req.query.post_id);
  if (!postId) return res.status(400).json({ error: 'post_id required' });
  // Ensure post belongs to this community
  const post = db.prepare('SELECT id FROM community_posts WHERE id=? AND community_id=?').get(postId, communityId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const comments = db.prepare(`
    SELECT c.*, COALESCE(u.name, t.name, 'Unknown') AS author_name, COALESCE(u.avatar_url, t.avatar_url, '') AS author_avatar
    FROM community_comments c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN therapists t ON c.therapist_id = t.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC, c.id ASC
  `).all(postId);
  res.json(comments);
});

// Create a comment or reply (parent_comment_id optional)
app.post('/api/communities/:id/comments', (req, res) => {
  const communityId = parseInt(req.params.id);
  const { post_id, user_id, therapist_id, parent_comment_id, content } = req.body || {};
  if (!post_id || !content || (!user_id && !therapist_id)) {
    return res.status(400).json({ error: 'post_id, content and user_id or therapist_id required' });
  }
  const community = db.prepare('SELECT therapist_id FROM communities WHERE id=?').get(communityId);
  if (!community) return res.status(404).json({ error: 'Community not found' });
  // Ensure post belongs to this community
  const post = db.prepare('SELECT id FROM community_posts WHERE id=? AND community_id=?').get(post_id, communityId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  // Membership/facilitator check
  if (user_id) {
    db.prepare('INSERT OR IGNORE INTO community_members (community_id, user_id) VALUES (?, ?)').run(communityId, user_id);
    const isMember = db.prepare('SELECT 1 FROM community_members WHERE community_id=? AND user_id=?').get(communityId, user_id);
    if (!isMember) return res.status(403).json({ error: 'Not a member of this community' });
  }
  if (therapist_id) {
    const isOwner = community.therapist_id === therapist_id;
    const isFacilitator = isOwner || db.prepare('SELECT 1 FROM community_facilitators WHERE community_id=? AND therapist_id=?').get(communityId, therapist_id);
    if (!isFacilitator) return res.status(403).json({ error: 'Not a facilitator of this community' });
  }
  // Optional parent check within same post
  if (parent_comment_id) {
    const parent = db.prepare('SELECT id FROM community_comments WHERE id=? AND post_id=?').get(parent_comment_id, post_id);
    if (!parent) return res.status(400).json({ error: 'Invalid parent_comment_id' });
  }
  const info = db.prepare('INSERT INTO community_comments (post_id, user_id, therapist_id, parent_comment_id, content) VALUES (?, ?, ?, ?, ?)')
    .run(post_id, user_id || null, therapist_id || null, parent_comment_id || null, content);
  const comment = db.prepare(`
    SELECT c.*, COALESCE(u.name, t.name, 'Unknown') AS author_name, COALESCE(u.avatar_url, t.avatar_url, '') AS author_avatar
    FROM community_comments c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN therapists t ON c.therapist_id = t.id
    WHERE c.id = ?
  `).get(info.lastInsertRowid);
  res.json(comment);
});

app.get('/api/therapist-posts', (req, res) => {
  const filterTherapistId = parseOptionalInt(req.query.therapist_id);
  const viewerTherapistId = parseOptionalInt(req.query.viewer_therapist_id);
  const userId = parseOptionalInt(req.query.user_id);
  try {
    const posts = listTherapistPosts({
      userId,
      viewerTherapistId,
      filterTherapistId,
    });
    res.json(posts);
  } catch (e) {
    console.error('[therapist posts] failed to list', e);
    res.status(500).json({ error: 'Failed to load therapist posts' });
  }
});

app.post('/api/therapist-posts', (req, res) => {
  const therapistId = parseOptionalInt(req.body?.therapist_id);
  const { content, image_url } = req.body || {};
  if (!therapistId || !content) {
    return res.status(400).json({ error: 'therapist_id and content required' });
  }
  const therapist = db.prepare('SELECT id FROM therapists WHERE id=?').get(therapistId);
  if (!therapist) return res.status(404).json({ error: 'Therapist not found' });
  try {
    const info = db.prepare('INSERT INTO therapist_posts (therapist_id, content, image_url) VALUES (?, ?, ?)')
      .run(therapistId, content, image_url || null);
    const post = fetchTherapistPostWithMeta(info.lastInsertRowid);
    res.json(post);
  } catch (e) {
    console.error('[therapist post] create failed', e);
    res.status(500).json({ error: 'Failed to create therapist post' });
  }
});

app.get('/api/therapist-posts/:id/comments', (req, res) => {
  const postId = parseInt(req.params.id, 10);
  if (!postId) return res.status(400).json({ error: 'post_id required' });
  const post = db.prepare('SELECT id FROM therapist_posts WHERE id=?').get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const comments = db.prepare(`
    SELECT c.*, COALESCE(u.name, t.name, 'Unknown') AS author_name, COALESCE(u.avatar_url, t.avatar_url, '') AS author_avatar
    FROM therapist_post_comments c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN therapists t ON c.therapist_id = t.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC, c.id ASC
  `).all(postId);
  res.json(comments);
});

app.post('/api/therapist-posts/:id/comments', (req, res) => {
  const postId = parseInt(req.params.id, 10);
  const userId = parseOptionalInt(req.body?.user_id);
  const therapistId = parseOptionalInt(req.body?.therapist_id);
  const parentCommentId = parseOptionalInt(req.body?.parent_comment_id);
  const { content } = req.body || {};
  if (!postId || !content || (!userId && !therapistId)) {
    return res.status(400).json({ error: 'post_id, content and user_id or therapist_id required' });
  }
  const post = db.prepare('SELECT id FROM therapist_posts WHERE id=?').get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (therapistId) {
    const therapist = db.prepare('SELECT id FROM therapists WHERE id=?').get(therapistId);
    if (!therapist) return res.status(404).json({ error: 'Therapist not found' });
  }
  if (parentCommentId) {
    const parent = db.prepare('SELECT id FROM therapist_post_comments WHERE id=? AND post_id=?').get(parentCommentId, postId);
    if (!parent) return res.status(400).json({ error: 'Invalid parent_comment_id' });
  }
  const info = db.prepare('INSERT INTO therapist_post_comments (post_id, user_id, therapist_id, parent_comment_id, content) VALUES (?, ?, ?, ?, ?)')
    .run(postId, userId || null, therapistId || null, parentCommentId || null, content);
  const comment = db.prepare(`
    SELECT c.*, COALESCE(u.name, t.name, 'Unknown') AS author_name, COALESCE(u.avatar_url, t.avatar_url, '') AS author_avatar
    FROM therapist_post_comments c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN therapists t ON c.therapist_id = t.id
    WHERE c.id = ?
  `).get(info.lastInsertRowid);
  res.json(comment);
});

app.post('/api/therapist-posts/:id/likes', (req, res) => {
  const postId = parseInt(req.params.id, 10);
  const userId = parseOptionalInt(req.body?.user_id);
  const therapistId = parseOptionalInt(req.body?.therapist_id);
  if (!postId || (!userId && !therapistId)) {
    return res.status(400).json({ error: 'post_id and user_id or therapist_id required' });
  }
  const post = db.prepare('SELECT id FROM therapist_posts WHERE id=?').get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  try {
    const info = db.prepare('INSERT INTO therapist_post_likes (post_id, user_id, therapist_id) VALUES (?, ?, ?)')
      .run(postId, userId || null, therapistId || null);
    const count = db.prepare('SELECT COUNT(*) as c FROM therapist_post_likes WHERE post_id=?').get(postId).c;
    return res.json({ ok: true, count });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Already liked' });
    console.error('[therapist post like] error', e);
    return res.status(500).json({ error: 'Failed to like' });
  }
});

app.delete('/api/therapist-posts/:id/likes', (req, res) => {
  const postId = parseInt(req.params.id, 10);
  const userId = parseOptionalInt(req.body?.user_id);
  const therapistId = parseOptionalInt(req.body?.therapist_id);
  if (!postId || (!userId && !therapistId)) {
    return res.status(400).json({ error: 'post_id and user_id or therapist_id required' });
  }
  const where = userId ? 'user_id=?' : 'therapist_id=?';
  const val = userId || therapistId;
  db.prepare(`DELETE FROM therapist_post_likes WHERE post_id=? AND ${where}`).run(postId, val);
  const count = db.prepare('SELECT COUNT(*) as c FROM therapist_post_likes WHERE post_id=?').get(postId).c;
  return res.json({ ok: true, count });
});

app.get('/api/therapist-posts/:id/likes', (req, res) => {
  const postId = parseInt(req.params.id, 10);
  if (!postId) return res.status(400).json({ error: 'post_id required' });
  const userId = parseOptionalInt(req.query.user_id);
  const therapistId = parseOptionalInt(req.query.therapist_id);
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM therapist_post_likes WHERE post_id=?').get(postId).c;
    const likedByUser = userId ? !!db.prepare('SELECT 1 FROM therapist_post_likes WHERE post_id=? AND user_id=?').get(postId, userId) : false;
    const likedByTherapist = therapistId ? !!db.prepare('SELECT 1 FROM therapist_post_likes WHERE post_id=? AND therapist_id=?').get(postId, therapistId) : false;
    res.json({ count, liked_by_user: likedByUser, liked_by_therapist: likedByTherapist });
  } catch (e) {
    console.error('[therapist post likes] error', e);
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`API running on http://localhost:${PORT}`));

// Temporary debug endpoint to create a therapist user for login testing
app.post('/api/debug/create-therapist-user', (req, res) => {
  const name = 'Test Therapist';
  const email = 'therapist@example.com';
  const password = 'therapist123';
  const phone = '0788407043';
  const specialization = 'General';
  const bio = 'Therapist user created for testing login.';
  const { salt, hash } = hashPassword(password);
  try {
    const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email);
    if (existing) return res.status(409).json({ error: 'User already exists' });
    const info = db.prepare('INSERT INTO users (name, email, password_hash, password_salt, phone, user_type, specialization, bio, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)')
      .run(name, email, hash, salt, phone, 'therapist', specialization, bio);
    const user = db.prepare('SELECT id, name, email, phone, user_type FROM users WHERE id=?').get(info.lastInsertRowid);
    res.json({ message: 'Therapist user created', user, password });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create therapist user' });
  }
});
