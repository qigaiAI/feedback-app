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

export default router;
