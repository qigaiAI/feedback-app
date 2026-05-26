import { Router, Response } from 'express';
import pool from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { generateFeedback, buildFeedbackFacts } from '../services/deepseek';

const router = Router();
router.use(authMiddleware);

router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const { students, template_id } = req.body;
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: '请选择学生' });
    }

    // Get style prompt from template or user default
    let stylePrompt: string | null = null;
    if (template_id) {
      const tRes = await pool.query(
        'SELECT style_prompt FROM templates WHERE id = $1 AND teacher_id = $2',
        [template_id, req.userId]
      );
      if (tRes.rows.length > 0) {
        stylePrompt = tRes.rows[0].style_prompt;
      }
    }
    if (!stylePrompt) {
      // Try default template
      const dRes = await pool.query(
        'SELECT style_prompt FROM templates WHERE teacher_id = $1 AND is_default = true LIMIT 1',
        [req.userId]
      );
      if (dRes.rows.length > 0) {
        stylePrompt = dRes.rows[0].style_prompt;
      }
    }
    if (!stylePrompt) {
      // Fallback to user's saved style_prompt
      const uRes = await pool.query('SELECT style_prompt FROM users WHERE id = $1', [req.userId]);
      stylePrompt = uRes.rows[0]?.style_prompt || null;
    }

    const results = [];

    for (const item of students) {
      const {
        student_id,
        evaluations,
        behavior_tags,
        knowledge_text,
        extra_comment,
        homework,
        previous_feedback_id,
        previous_feedback_text,
      } = item;

      // Get student info
      const sRes = await pool.query(
        'SELECT name, grade, notes FROM students WHERE id = $1 AND teacher_id = $2',
        [student_id, req.userId]
      );
      if (sRes.rows.length === 0) {
        results.push({ student_id, content: '（学生不存在）' });
        continue;
      }
      const student = sRes.rows[0];

      // Resolve previous feedback text
      let prevText = previous_feedback_text || null;
      if (!prevText && previous_feedback_id) {
        const pfRes = await pool.query(
          'SELECT content FROM feedbacks WHERE id = $1 AND teacher_id = $2',
          [previous_feedback_id, req.userId]
        );
        if (pfRes.rows.length > 0) {
          prevText = pfRes.rows[0].content;
        }
      }

      const facts = buildFeedbackFacts({
        student: { name: student.name, grade: student.grade, notes: student.notes },
        evaluations,
        behavior_tags,
        knowledge_text,
        extra_comment,
        homework,
        previous_feedback_text: prevText,
      });

      const content = await generateFeedback(stylePrompt, facts);

      // Save to database
      const usedBehaviorTags = behavior_tags?.length > 0 ? behavior_tags : null;
      const rawInput = {
        evaluations,
        behavior_tags: usedBehaviorTags,
        knowledge_text: knowledge_text || null,
        extra_comment: extra_comment || null,
        homework: homework || null,
      };

      await pool.query(
        `INSERT INTO feedbacks (teacher_id, student_id, content, raw_input, homework, previous_feedback_id, knowledge_text, used_template_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          req.userId,
          student_id,
          content,
          JSON.stringify(rawInput),
          homework || null,
          previous_feedback_id || null,
          knowledge_text || null,
          template_id || null,
        ]
      );

      results.push({ student_id, content, student_name: student.name });
    }

    res.json({ feedbacks: results });
  } catch (err) {
    console.error('Generate feedback error:', err);
    res.status(500).json({ error: '生成反馈失败，请稍后重试' });
  }
});

router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const { student_id, start_date, end_date, search, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const pLimit = parseInt(limit as string);

    let query = `
      SELECT f.*, s.name AS student_name
      FROM feedbacks f
      JOIN students s ON f.student_id = s.id
      WHERE f.teacher_id = $1 AND f.is_deleted = false
    `;
    const params: any[] = [req.userId];
    let paramIdx = 2;

    if (student_id) {
      query += ` AND f.student_id = $${paramIdx}`;
      params.push(student_id);
      paramIdx++;
    }
    if (start_date) {
      query += ` AND f.created_at >= $${paramIdx}`;
      params.push(start_date);
      paramIdx++;
    }
    if (end_date) {
      query += ` AND f.created_at <= $${paramIdx}`;
      params.push(end_date);
      paramIdx++;
    }
    if (search) {
      query += ` AND (f.content ILIKE $${paramIdx} OR s.name ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    query += ` ORDER BY f.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(pLimit, offset);

    const result = await pool.query(query, params);

    // Count total
    let countQuery = `
      SELECT COUNT(*) FROM feedbacks f
      JOIN students s ON f.student_id = s.id
      WHERE f.teacher_id = $1 AND f.is_deleted = false
    `;
    const countParams: any[] = [req.userId];
    let cIdx = 2;
    if (student_id) { countQuery += ` AND f.student_id = $${cIdx}`; countParams.push(student_id); cIdx++; }
    if (start_date) { countQuery += ` AND f.created_at >= $${cIdx}`; countParams.push(start_date); cIdx++; }
    if (end_date) { countQuery += ` AND f.created_at <= $${cIdx}`; countParams.push(end_date); cIdx++; }
    if (search) { countQuery += ` AND (f.content ILIKE $${cIdx} OR s.name ILIKE $${cIdx})`; countParams.push(`%${search}%`); cIdx++; }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      feedbacks: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page as string),
      limit: pLimit,
    });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: '获取历史反馈失败' });
  }
});

router.get('/last/:studentId', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM feedbacks
       WHERE teacher_id = $1 AND student_id = $2 AND is_deleted = false
       ORDER BY created_at DESC LIMIT 1`,
      [req.userId, req.params.studentId]
    );
    res.json({ feedback: result.rows[0] || null });
  } catch (err) {
    console.error('Get last feedback error:', err);
    res.status(500).json({ error: '获取上节课反馈失败' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT f.*, s.name AS student_name
       FROM feedbacks f
       JOIN students s ON f.student_id = s.id
       WHERE f.id = $1 AND f.teacher_id = $2`,
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '反馈不存在' });
    }
    res.json({ feedback: result.rows[0] });
  } catch (err) {
    console.error('Get feedback error:', err);
    res.status(500).json({ error: '获取反馈详情失败' });
  }
});

export default router;
