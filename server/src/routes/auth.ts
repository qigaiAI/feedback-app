import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { sendVerificationCode } from '../services/email';

const router = Router();

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

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
    const verification_code = generateCode();
    const verification_code_expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, email_verified, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, false, $4, $5)
       RETURNING id, email, name, role, membership_type, email_verified, style_prompt, created_at`,
      [email, password_hash, name, verification_code, verification_code_expires]
    );
    const user = result.rows[0];

    // Send verification code via Tencent SES (non-blocking)
    sendVerificationCode(email, verification_code).catch(err =>
      console.error('Failed to send verification code:', err)
    );

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.status(201).json({ user, token });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: '注册失败' });
  }
});

router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: '请输入邮箱和密码' });
    }

    const result = await pool.query(
      'SELECT id, email, password_hash, name, role, membership_type, email_verified, style_prompt, created_at FROM users WHERE email = $1',
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
      'SELECT id, email, name, role, membership_type, email_verified, style_prompt, created_at, updated_at FROM users WHERE id = $1',
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

// Verify email by entering verification code
router.post('/verify-email', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: '请输入验证码' });
    }

    const result = await pool.query(
      `UPDATE users SET email_verified = true, verification_token = NULL, verification_token_expires = NULL
       WHERE id = $1 AND verification_token = $2 AND verification_token_expires > now() AND email_verified = false
       RETURNING id`,
      [req.userId, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

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
      return res.status(400).json({ error: '邮箱已验证，无需重新发送' });
    }

    const verification_code = generateCode();
    const verification_code_expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3',
      [verification_code, verification_code_expires, req.userId]
    );

    const sent = await sendVerificationCode(user.email, verification_code);
    if (!sent) {
      return res.status(500).json({ error: '发送验证码失败，请稍后重试' });
    }

    res.json({ success: true, message: '验证码已重新发送' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: '发送失败' });
  }
});

// Send verification code for password reset
router.post('/forgot-password', async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: '请输入邮箱' });
    }

    const userResult = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      // Don't reveal whether user exists
      return res.json({ success: true, message: '如果该邮箱已注册，验证码已发送' });
    }

    const user = userResult.rows[0];
    const reset_code = generateCode();
    const reset_code_expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3',
      [reset_code, reset_code_expires, user.id]
    );

    await sendVerificationCode(user.email, reset_code);

    // Return a temp token for reset-password step
    const tempToken = jwt.sign(
      { userId: user.id, purpose: 'reset-password' },
      process.env.JWT_SECRET!,
      { expiresIn: '10m' }
    );

    res.json({ success: true, message: '验证码已发送', reset_token: tempToken });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: '发送失败' });
  }
});

// Reset password with verification code
router.post('/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    const { email, code, new_password, reset_token } = req.body;
    if (!email || !code || !new_password || !reset_token) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: '密码至少6个字符' });
    }

    // Verify temp token
    let payload: any;
    try {
      payload = jwt.verify(reset_token, process.env.JWT_SECRET!);
    } catch {
      return res.status(400).json({ error: '操作已过期，请重新获取验证码' });
    }

    if (payload.purpose !== 'reset-password') {
      return res.status(400).json({ error: '无效的请求' });
    }

    // Verify code
    const userResult = await pool.query(
      `SELECT id FROM users
       WHERE email = $1 AND verification_token = $2 AND verification_token_expires > now()`,
      [email, code]
    );
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await pool.query(
      `UPDATE users SET password_hash = $1, verification_token = NULL,
       verification_token_expires = NULL, email_verified = true
       WHERE id = $2`,
      [password_hash, userResult.rows[0].id]
    );

    res.json({ success: true, message: '密码重置成功，请登录' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: '重置密码失败' });
  }
});

export default router;
