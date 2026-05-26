import { Router, Response } from 'express';
import pool from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// List templates
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM templates WHERE teacher_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json({ templates: result.rows });
  } catch (err) {
    console.error('List templates error:', err);
    res.status(500).json({ error: '获取模板列表失败' });
  }
});

// Create template (max 3)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, style_prompt, is_default } = req.body;
    if (!name || !style_prompt) {
      return res.status(400).json({ error: '请填写模板名称和风格指令' });
    }

    const count = await pool.query(
      'SELECT COUNT(*)::int FROM templates WHERE teacher_id = $1',
      [req.userId]
    );
    if (count.rows[0].count >= 3) {
      return res.status(400).json({ error: '最多保存3个模板' });
    }

    // If setting as default, unset others
    if (is_default) {
      await pool.query('UPDATE templates SET is_default = false WHERE teacher_id = $1', [req.userId]);
    }

    const result = await pool.query(
      'INSERT INTO templates (teacher_id, name, style_prompt, is_default) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.userId, name, style_prompt, is_default || false]
    );
    res.status(201).json({ template: result.rows[0] });
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: '创建模板失败' });
  }
});

// Update template
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, style_prompt, is_default } = req.body;

    // Verify ownership
    const existing = await pool.query(
      'SELECT * FROM templates WHERE id = $1 AND teacher_id = $2',
      [req.params.id, req.userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: '模板不存在' });
    }

    // If setting as default, unset others
    if (is_default) {
      await pool.query('UPDATE templates SET is_default = false WHERE teacher_id = $1', [req.userId]);
    }

    const result = await pool.query(
      `UPDATE templates
       SET name = COALESCE($1, name),
           style_prompt = COALESCE($2, style_prompt),
           is_default = COALESCE($3, is_default),
           updated_at = now()
       WHERE id = $4 AND teacher_id = $5
       RETURNING *`,
      [name || null, style_prompt || null, is_default !== undefined ? is_default : null, req.params.id, req.userId]
    );
    res.json({ template: result.rows[0] });
  } catch (err) {
    console.error('Update template error:', err);
    res.status(500).json({ error: '更新模板失败' });
  }
});

// Set default
router.put('/:id/default', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('UPDATE templates SET is_default = false WHERE teacher_id = $1', [req.userId]);
    const result = await pool.query(
      'UPDATE templates SET is_default = true, updated_at = now() WHERE id = $1 AND teacher_id = $2 RETURNING *',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '模板不存在' });
    }
    res.json({ template: result.rows[0] });
  } catch (err) {
    console.error('Set default template error:', err);
    res.status(500).json({ error: '设置默认模板失败' });
  }
});

// Delete template
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'DELETE FROM templates WHERE id = $1 AND teacher_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '模板不存在' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ error: '删除模板失败' });
  }
});

export default router;
