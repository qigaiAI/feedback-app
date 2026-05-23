import fs from 'fs';
import path from 'path';
import pool from './db';

async function initDb() {
  const sql = fs.readFileSync(path.join(__dirname, 'init_db.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Database init error:', err);
    throw err;
  } finally {
    client.release();
  }
}

initDb()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
