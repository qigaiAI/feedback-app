import pool from '../db';

const GRADE_ORDER = [
  '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
  '初一', '初二', '初三',
  '高一', '高二', '高三',
];

const NEXT_GRADE: Record<string, string> = {
  '一年级': '二年级',
  '二年级': '三年级',
  '三年级': '四年级',
  '四年级': '五年级',
  '五年级': '六年级',
  '六年级': '初一',
  '初一': '初二',
  '初二': '初三',
  '初三': '高一',
  '高一': '高二',
  '高二': '高三',
  '高三': '已毕业',
};

export async function checkAndPromoteGrades(): Promise<void> {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Only run on or after September 1
    if (now.getMonth() < 8) return;

    // Check if promotion has already been done for this academic year
    const configRes = await pool.query(
      `SELECT value FROM system_config WHERE key = 'grade_promotion_year'`
    );

    if (configRes.rows.length > 0 && parseInt(configRes.rows[0].value) >= currentYear) {
      return; // Already promoted this year
    }

    console.log(`[grade-promotion] Running grade promotion for academic year ${currentYear}...`);

    // Promote all standard grades
    let promotedCount = 0;
    for (const grade of GRADE_ORDER) {
      const nextGrade = NEXT_GRADE[grade];
      if (!nextGrade) continue;

      const result = await pool.query(
        'UPDATE students SET grade = $1, updated_at = NOW() WHERE grade = $2',
        [nextGrade, grade]
      );
      promotedCount += result.rowCount || 0;
    }

    // Update or insert the config
    if (configRes.rows.length > 0) {
      await pool.query(
        "UPDATE system_config SET value = $1, updated_at = NOW() WHERE key = 'grade_promotion_year'",
        [String(currentYear)]
      );
    } else {
      await pool.query(
        "INSERT INTO system_config (key, value) VALUES ('grade_promotion_year', $1)",
        [String(currentYear)]
      );
    }

    console.log(`[grade-promotion] Done. Promoted ${promotedCount} students.`);
  } catch (err) {
    console.error('[grade-promotion] Error:', err);
  }
}
