import { Router, Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';

function checkAdmin(req: AuthRequest, res: Response, next: Function) {
  const key = req.headers['x-admin-key'] || req.query.admin_key;
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Invalid admin key' });
  }
  next();
}

router.use(checkAdmin as any);

// List all users
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, role, email_verified, membership_type, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Admin list users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// Delete user
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Set email verified status
router.put('/users/:id/verify', async (req: AuthRequest, res: Response) => {
  try {
    const { verified } = req.body;
    await pool.query(
      'UPDATE users SET email_verified = $1, verification_token = NULL, verification_token_expires = NULL WHERE id = $2',
      [verified, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Admin verify user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Get verification code for user (for debugging)
router.get('/users/:id/code', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT email, verification_token, verification_token_expires FROM users WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin get code error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// List messages
router.get('/messages', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.content, m.created_at, u.email, u.name
       FROM messages m
       JOIN users u ON m.user_id = u.id
       ORDER BY m.created_at DESC
       LIMIT 100`
    );
    res.json({ messages: result.rows });
  } catch (err) {
    console.error('Admin list messages error:', err);
    res.status(500).json({ error: 'Failed to list messages' });
  }
});

// ======= Upgrade Keys =======

function generateKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = '';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    if (i < 3) key += '-';
  }
  return key;
}

// Generate upgrade keys
router.post('/upgrade-keys/generate', async (req: AuthRequest, res: Response) => {
  try {
    const { count = 1 } = req.body;
    if (count < 1 || count > 50) {
      return res.status(400).json({ error: '数量需在 1-50 之间' });
    }

    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
      const key = generateKey();
      await pool.query('INSERT INTO upgrade_keys (key) VALUES ($1)', [key]);
      keys.push(key);
    }

    res.json({ keys });
  } catch (err) {
    console.error('Generate keys error:', err);
    res.status(500).json({ error: '生成失败' });
  }
});

// List upgrade keys
router.get('/upgrade-keys', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT k.*, u.email AS used_by_email, u.name AS used_by_name
       FROM upgrade_keys k
       LEFT JOIN users u ON k.used_by = u.id
       ORDER BY k.created_at DESC
       LIMIT 200`
    );
    res.json({ keys: result.rows });
  } catch (err) {
    console.error('List upgrade keys error:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

export default router;
