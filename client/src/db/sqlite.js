import * as SQLite from 'expo-sqlite';

let db = null;

export const initDatabase = async () => {
  try {
    db = await SQLite.openDatabaseAsync('medicare.db');
    console.log('[DB] Database initialized');
    return db;
  } catch (error) {
    console.error('[DB] Error initializing database:', error);
    throw error;
  }
};

export const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
};

export const closeDatabase = async () => {
  if (db) {
    await db.closeAsync();
    db = null;
  }
};

export default {
  initDatabase,
  getDatabase,
  closeDatabase,
};
