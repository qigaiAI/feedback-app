import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { sendVerificationCode } from '../services/email';

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const router = Router();

router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6个字符' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: '该邮箱已注册' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, role, email_verified, membership_type, style_prompt, nickname, created_at',
      [email, password_hash, name]
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    // Auto-send verification code on register
    try {
      const code = generateCode();
      await pool.query(
        'INSERT INTO verification_codes (email, code, type, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'10 minutes\')',
        [email, code, 'register']
      );
      await sendVerificationCode(email, code);
    } catch (e) {
      console.error('Failed to send verification code on register:', e);
    }

    res.status(201).json({ user, token });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: '注册失败' });
  }
});

// Verify email with code
router.post('/verify-email', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: '请输入验证码' });
    }

    const result = await pool.query(
      'DELETE FROM verification_codes WHERE email = (SELECT email FROM users WHERE id = $1) AND code = $2 AND type = $3 AND expires_at > NOW() RETURNING *',
      [req.userId, code, 'register']
    );

    if (result.rows.length === 0) {
      // Also try reset type
      const resetResult = await pool.query(
        'DELETE FROM verification_codes WHERE email = (SELECT email FROM users WHERE id = $1) AND code = $2 AND type = $3 AND expires_at > NOW() RETURNING *',
        [req.userId, code, 'reset']
      );
      if (resetResult.rows.length === 0) {
        return res.status(400).json({ error: '验证码错误或已过期' });
      }
    }

    await pool.query('UPDATE users SET email_verified = true WHERE id = $1', [req.userId]);
    res.json({ success: true, message: '邮箱验证成功' });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: '验证失败' });
  }
});

// Resend verification code
router.post('/resend-verification', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userResult = await pool.query(
      'SELECT email, email_verified FROM users WHERE id = $1',
      [req.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = userResult.rows[0];
    if (user.email_verified) {
      return res.status(400).json({ error: '邮箱已验证' });
    }

    await pool.query('DELETE FROM verification_codes WHERE email = $1 AND type = $2', [user.email, 'register']);

    const code = generateCode();
    await pool.query(
      'INSERT INTO verification_codes (email, code, type, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'10 minutes\')',
      [user.email, code, 'register']
    );
    await sendVerificationCode(user.email, code);
    res.json({ message: '验证码已发送' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: '发送失败' });
  }
});

router.post('/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, code } = req.body;
    if (!email || !password || !code) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6个字符' });
    }

    // Verify reset code
    const codeResult = await pool.query(
      'SELECT id FROM verification_codes WHERE email = $1 AND code = $2 AND type = $3 AND expires_at > NOW()',
      [email, code, 'reset']
    );
    if (codeResult.rows.length === 0) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2', [password_hash, email]);
    await pool.query('DELETE FROM verification_codes WHERE email = $1 AND type = $2', [email, 'reset']);

    res.json({ message: '密码重置成功，请重新登录' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: '密码重置失败' });
  }
});

router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: '请输入邮箱和密码' });
    }

    const result = await pool.query(
      'SELECT id, email, password_hash, name, role, email_verified, membership_type, style_prompt, nickname, created_at FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const { password_hash, ...userData } = user;
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.json({ user: userData, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '登录失败' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, email_verified, membership_type, style_prompt, nickname, created_at, updated_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// Update profile (name, nickname)
router.put('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, nickname } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      params.push(name);
    }
    if (nickname !== undefined) {
      updates.push(`nickname = $${idx++}`);
      params.push(nickname || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    updates.push(`updated_at = now()`);
    params.push(req.userId);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email, name, role, email_verified, membership_type, style_prompt, nickname, created_at, updated_at`,
      params
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

export default router;
