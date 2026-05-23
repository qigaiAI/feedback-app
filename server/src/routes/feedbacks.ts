import { Router, Response } from 'express';
import pool from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { generateFeedback } from '../services/deepseek';

const router = Router();
router.use(authMiddleware);

router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const { students } = req.body;
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: '请选择学生' });
    }

    // Get teacher's style prompt
    const userR = await pool.query('SELECT style_prompt, name FROM users WHERE id = $1', [req.userId]);
    const stylePrompt = userR.rows[0]?.style_prompt || null;

    const results = [];

    for (const item of students) {
      const { student_id, evaluations, behavior_tags, knowledge_tag_ids, extra_comment } = item;

      // Build facts from evaluation data
      const parts: string[] = [];

      if (evaluations) {
        if (evaluations.focus) {
          parts.push(`专注度：${'★'.repeat(evaluations.focus)}${'☆'.repeat(5 - evaluations.focus)} (${evaluations.focus}/5)`);
        }
        if (evaluations.accuracy) {
          parts.push(`正确率：${'★'.repeat(evaluations.accuracy)}${'☆'.repeat(5 - evaluations.accuracy)} (${evaluations.accuracy}/5)`);
        }
        if (evaluations.mastery) {
          const masteryMap: Record<string, string> = {
            'mastered': '已掌握',
            'partial': '部分掌握',
            'not_mastered': '未掌握',
          };
          parts.push(`掌握情况：${masteryMap[evaluations.mastery] || evaluations.mastery}`);
        }
      }

      if (behavior_tags && behavior_tags.length > 0) {
        const tagResult = await pool.query(
          'SELECT name FROM behavior_tags WHERE name = ANY($1)',
          [behavior_tags]
        );
        const names = tagResult.rows.map((r: any) => r.name);
        if (names.length > 0) {
          parts.push(`课堂表现：${names.join('、')}`);
        }
      }

      if (knowledge_tag_ids && knowledge_tag_ids.length > 0) {
        const ktResult = await pool.query(
          'SELECT name FROM knowledge_tags WHERE id = ANY($1)',
          [knowledge_tag_ids]
        );
        const names = ktResult.rows.map((r: any) => r.name);
        if (names.length > 0) {
          parts.push(`学习内容：${names.join('、')}`);
        }
      }

      if (extra_comment) {
        parts.push(`老师补充：${extra_comment}`);
      }

      const facts = parts.join('\n');
      if (!facts) {
        results.push({ student_id, content: '（未提供评价信息）' });
        continue;
      }

      const content = await generateFeedback(stylePrompt, facts);

      // Save to database
      await pool.query(
        `INSERT INTO feedbacks (teacher_id, student_id, content, raw_input, used_tags)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          req.userId,
          student_id,
          content,
          JSON.stringify({ evaluations, behavior_tags, extra_comment }),
          knowledge_tag_ids || null,
        ]
      );

      results.push({ student_id, content });
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
