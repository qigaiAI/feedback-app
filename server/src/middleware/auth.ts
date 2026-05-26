import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db';

export interface AuthRequest extends Request {
  userId?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

// Middleware that requires email to be verified
export async function requireVerified(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      'SELECT email_verified FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: '用户不存在' });
    }
    if (!result.rows[0].email_verified) {
      return res.status(403).json({ error: '请先验证邮箱', code: 'EMAIL_NOT_VERIFIED' });
    }
    next();
  } catch (err) {
    console.error('requireVerified error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
}
