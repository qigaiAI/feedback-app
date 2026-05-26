import { Router, Response } from 'express';
import pool from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// Submit a message/feedback
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: '请输入留言内容' });
    }
    await pool.query(
      'INSERT INTO messages (user_id, content) VALUES ($1, $2)',
      [req.userId, content.trim()]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Create message error:', err);
    res.status(500).json({ error: '提交失败' });
  }
});

export default router;
