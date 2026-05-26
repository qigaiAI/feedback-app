import { Router, Response } from 'express';
import pool from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { analyzeStyle, previewStyle } from '../services/deepseek';

const router = Router();
router.use(authMiddleware);

router.get('/style-prompt', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT style_prompt FROM users WHERE id = $1', [req.userId]);
    res.json({ style_prompt: result.rows[0]?.style_prompt || null });
  } catch (err) {
    console.error('Get style prompt error:', err);
    res.status(500).json({ error: '获取风格指令失败' });
  }
});

router.put('/style-prompt', async (req: AuthRequest, res: Response) => {
  try {
    const { prompt } = req.body;
    await pool.query('UPDATE users SET style_prompt = $1, updated_at = now() WHERE id = $2', [
      prompt || null,
      req.userId,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error('Update style prompt error:', err);
    res.status(500).json({ error: '保存风格指令失败' });
  }
});

router.post('/analyze-style', async (req: AuthRequest, res: Response) => {
  try {
    const { samples } = req.body;
    if (!samples || !Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({ error: '请提供反馈样本' });
    }
    const instruction = await analyzeStyle(samples);
    res.json({ instruction });
  } catch (err) {
    console.error('Analyze style error:', err);
    res.status(500).json({ error: '分析风格失败，请稍后重试' });
  }
});

router.post('/preview-style', async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, test_description } = req.body;
    if (!prompt || !test_description) {
      return res.status(400).json({ error: '请提供风格指令和测试描述' });
    }
    const result = await previewStyle(prompt, test_description);
    res.json({ preview: result });
  } catch (err) {
    console.error('Preview style error:', err);
    res.status(500).json({ error: '预览失败，请稍后重试' });
  }
});

export default router;
