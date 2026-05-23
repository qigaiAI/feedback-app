import { Router, Response } from 'express';
import pool from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Knowledge tags - tree structure
router.get('/knowledge', async (req: AuthRequest, res: Response) => {
  try {
    const { parent_id } = req.query;
    if (parent_id) {
      const result = await pool.query(
        'SELECT * FROM knowledge_tags WHERE parent_id = $1 ORDER BY order_num, name',
        [parent_id]
      );
      return res.json({ tags: result.rows });
    }
    // Return full tree
    const result = await pool.query(
      'SELECT * FROM knowledge_tags ORDER BY level, order_num, name'
    );
    res.json({ tags: result.rows });
  } catch (err) {
    console.error('Get knowledge tags error:', err);
    res.status(500).json({ error: '获取知识标签失败' });
  }
});

router.post('/knowledge', async (req: AuthRequest, res: Response) => {
  try {
    const { name, parent_id } = req.body;
    if (!name || !parent_id) {
      return res.status(400).json({ error: '请提供标签名称和父级ID' });
    }

    // Only allow level 4 (knowledge point) custom tags
    const parent = await pool.query('SELECT * FROM knowledge_tags WHERE id = $1', [parent_id]);
    if (parent.rows.length === 0) {
      return res.status(404).json({ error: '父级标签不存在' });
    }
    if (parent.rows[0].level !== 3) {
      return res.status(400).json({ error: '只能在专题下添加知识点标签' });
    }

    const result = await pool.query(
      'INSERT INTO knowledge_tags (level, name, parent_id, order_num) VALUES (4, $1, $2, 99) RETURNING *',
      [name, parent_id]
    );
    res.status(201).json({ tag: result.rows[0] });
  } catch (err) {
    console.error('Create knowledge tag error:', err);
    res.status(500).json({ error: '添加知识标签失败' });
  }
});

router.put('/knowledge/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    const result = await pool.query(
      'UPDATE knowledge_tags SET name = $1 WHERE id = $2 AND level = 4 RETURNING *',
      [name, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '标签不存在或不可修改' });
    }
    res.json({ tag: result.rows[0] });
  } catch (err) {
    console.error('Update knowledge tag error:', err);
    res.status(500).json({ error: '更新知识标签失败' });
  }
});

router.delete('/knowledge/:id', async (req: AuthRequest, res: Response) => {
  try {
    // Only allow deletion of custom level-4 tags
    const result = await pool.query(
      'DELETE FROM knowledge_tags WHERE id = $1 AND level = 4 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '标签不存在或不可删除' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete knowledge tag error:', err);
    res.status(500).json({ error: '删除知识标签失败' });
  }
});

// Behavior tags
router.get('/behavior', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM behavior_tags WHERE teacher_id IS NULL OR teacher_id = $1 ORDER BY teacher_id NULLS FIRST, name',
      [req.userId]
    );
    res.json({ tags: result.rows });
  } catch (err) {
    console.error('Get behavior tags error:', err);
    res.status(500).json({ error: '获取行为标签失败' });
  }
});

router.post('/behavior', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: '请提供标签名称' });
    }
    const result = await pool.query(
      'INSERT INTO behavior_tags (teacher_id, name) VALUES ($1, $2) RETURNING *',
      [req.userId, name]
    );
    res.status(201).json({ tag: result.rows[0] });
  } catch (err) {
    console.error('Create behavior tag error:', err);
    res.status(500).json({ error: '添加行为标签失败' });
  }
});

router.put('/behavior/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    const result = await pool.query(
      'UPDATE behavior_tags SET name = $1 WHERE id = $2 AND teacher_id = $3 RETURNING *',
      [name, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '标签不存在或无权修改' });
    }
    res.json({ tag: result.rows[0] });
  } catch (err) {
    console.error('Update behavior tag error:', err);
    res.status(500).json({ error: '更新行为标签失败' });
  }
});

router.delete('/behavior/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'DELETE FROM behavior_tags WHERE id = $1 AND (teacher_id = $2 OR teacher_id IS NULL) RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '标签不存在或无权删除' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete behavior tag error:', err);
    res.status(500).json({ error: '删除行为标签失败' });
  }
});

export default router;
