import { Router, Response } from 'express';
import pool from '../db';
import { AuthRequest, authMiddleware, requireVerified } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);
router.use(requireVerified);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    let result = await pool.query(
      `SELECT g.*, COUNT(sg.student_id)::int AS student_count
       FROM groups g
       LEFT JOIN student_groups sg ON g.id = sg.group_id
       WHERE g.teacher_id = $1
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [req.userId]
    );

    // Auto-create default class if user has none
    if (result.rows.length === 0) {
      const defaultName = `周六 8:00-10:00 班级`;
      await pool.query(
        'INSERT INTO groups (teacher_id, name) VALUES ($1, $2)',
        [req.userId, defaultName]
      );
      result = await pool.query(
        `SELECT g.*, COUNT(sg.student_id)::int AS student_count
         FROM groups g
         LEFT JOIN student_groups sg ON g.id = sg.group_id
         WHERE g.teacher_id = $1
         GROUP BY g.id
         ORDER BY g.created_at DESC`,
        [req.userId]
      );
    }

    res.json({ groups: result.rows });
  } catch (err) {
    console.error('List groups error:', err);
    res.status(500).json({ error: '获取分组列表失败' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: '请填写分组名称' });
    }
    const result = await pool.query(
      'INSERT INTO groups (teacher_id, name) VALUES ($1, $2) RETURNING *',
      [req.userId, name]
    );
    res.status(201).json({ group: result.rows[0] });
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: '创建分组失败' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    const result = await pool.query(
      'UPDATE groups SET name = $1 WHERE id = $2 AND teacher_id = $3 RETURNING *',
      [name, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '分组不存在' });
    }
    res.json({ group: result.rows[0] });
  } catch (err) {
    console.error('Update group error:', err);
    res.status(500).json({ error: '更新分组失败' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'DELETE FROM groups WHERE id = $1 AND teacher_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '分组不存在' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete group error:', err);
    res.status(500).json({ error: '删除分组失败' });
  }
});

router.post('/:id/students', async (req: AuthRequest, res: Response) => {
  try {
    const { student_ids } = req.body;
    if (!student_ids || !Array.isArray(student_ids)) {
      return res.status(400).json({ error: '请提供学生ID列表' });
    }

    // Verify group belongs to teacher
    const g = await pool.query('SELECT id FROM groups WHERE id = $1 AND teacher_id = $2', [
      req.params.id,
      req.userId,
    ]);
    if (g.rows.length === 0) {
      return res.status(404).json({ error: '分组不存在' });
    }

    for (const sid of student_ids) {
      await pool.query(
        'INSERT INTO student_groups (student_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [sid, req.params.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Add students to group error:', err);
    res.status(500).json({ error: '添加学生到分组失败' });
  }
});

export default router;
