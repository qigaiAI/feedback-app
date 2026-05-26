import { Router, Response } from 'express';
import pool from '../db';
import { sendVerificationCode } from '../services/email';

const router = Router();

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Send verification code (register or reset password)
router.post('/send-code', async (req, res: Response) => {
  try {
    const { email, type } = req.body; // type: 'register' | 'reset'
    if (!email || !type) {
      return res.status(400).json({ error: '参数错误' });
    }
    if (!['register', 'reset'].includes(type)) {
      return res.status(400).json({ error: '类型错误' });
    }

    // For register, check if email already exists
    if (type === 'register') {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: '该邮箱已注册' });
      }
    }

    // For reset, check if email exists
    if (type === 'reset') {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: '该邮箱未注册' });
      }
    }

    // Delete old codes for this email
    await pool.query('DELETE FROM verification_codes WHERE email = $1 AND type = $2', [email, type]);

    // Generate and store new code
    const code = generateCode();
    await pool.query(
      'INSERT INTO verification_codes (email, code, type, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'10 minutes\')',
      [email, code, type]
    );

    await sendVerificationCode(email, code);
    res.json({ message: '验证码已发送' });
  } catch (err: any) {
    console.error('Send code error:', err);
    res.status(500).json({ error: '发送验证码失败' });
  }
});

export default router;
