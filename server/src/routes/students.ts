import { Router, Response } from 'express';
import pool from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, group_id } = req.query;
    let query = 'SELECT * FROM students WHERE teacher_id = $1';
    const params: any[] = [req.userId];
    let paramIdx = 2;

    if (search) {
      query += ` AND name ILIKE $${paramIdx}`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (group_id) {
      query += ` AND id IN (SELECT student_id FROM student_groups WHERE group_id = $${paramIdx})`;
      params.push(group_id);
      paramIdx++;
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);

    // Get groups for each student
    const students = await Promise.all(
      result.rows.map(async (s) => {
        const gr = await pool.query(
          `SELECT g.id, g.name FROM groups g
           JOIN student_groups sg ON g.id = sg.group_id
           WHERE sg.student_id = $1`,
          [s.id]
        );
        return { ...s, groups: gr.rows };
      })
    );

    res.json({ students });
  } catch (err) {
    console.error('List students error:', err);
    res.status(500).json({ error: '获取学生列表失败' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, grade, notes, group_ids, new_class_name } = req.body;
    if (!name) {
      return res.status(400).json({ error: '请填写学生姓名' });
    }

    const result = await pool.query(
      'INSERT INTO students (teacher_id, name, grade, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.userId, name, grade || null, notes || null]
    );
    const student = result.rows[0];

    // Auto-create class if new_class_name is provided
    let allGroupIds = group_ids || [];
    if (new_class_name && new_class_name.trim()) {
      const classResult = await pool.query(
        'INSERT INTO groups (teacher_id, name) VALUES ($1, $2) RETURNING id',
        [req.userId, new_class_name.trim()]
      );
      allGroupIds = [...allGroupIds, classResult.rows[0].id];
    }

    // Add to groups if specified
    if (allGroupIds.length > 0) {
      for (const gid of allGroupIds) {
        await pool.query(
          'INSERT INTO student_groups (student_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [student.id, gid]
        );
      }
    }

    res.status(201).json({ student });
  } catch (err) {
    console.error('Create student error:', err);
    res.status(500).json({ error: '添加学生失败' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM students WHERE id = $1 AND teacher_id = $2',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '学生不存在' });
    }
    const student = result.rows[0];
    const gr = await pool.query(
      `SELECT g.id, g.name FROM groups g
       JOIN student_groups sg ON g.id = sg.group_id
       WHERE sg.student_id = $1`,
      [student.id]
    );
    res.json({ student: { ...student, groups: gr.rows } });
  } catch (err) {
    console.error('Get student error:', err);
    res.status(500).json({ error: '获取学生信息失败' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, grade, notes, group_ids, new_class_name } = req.body;
    const result = await pool.query(
      `UPDATE students SET name = COALESCE($1, name), grade = $2, notes = $3, updated_at = now()
       WHERE id = $4 AND teacher_id = $5 RETURNING *`,
      [name, grade, notes, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '学生不存在' });
    }

    // Auto-create class if new_class_name is provided
    let allGroupIds = group_ids || [];
    if (new_class_name && new_class_name.trim()) {
      const classResult = await pool.query(
        'INSERT INTO groups (teacher_id, name) VALUES ($1, $2) RETURNING id',
        [req.userId, new_class_name.trim()]
      );
      allGroupIds = [...allGroupIds, classResult.rows[0].id];
    }

    // Update groups
    if (group_ids !== undefined || new_class_name) {
      if (group_ids !== undefined) {
        await pool.query('DELETE FROM student_groups WHERE student_id = $1', [req.params.id]);
      }
      for (const gid of allGroupIds) {
        await pool.query(
          'INSERT INTO student_groups (student_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, gid]
        );
      }
    }

    res.json({ student: result.rows[0] });
  } catch (err) {
    console.error('Update student error:', err);
    res.status(500).json({ error: '更新学生信息失败' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'DELETE FROM students WHERE id = $1 AND teacher_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '学生不存在' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete student error:', err);
    res.status(500).json({ error: '删除学生失败' });
  }
});

export default router;
