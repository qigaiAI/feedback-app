/**
 * 数据库迁移执行器
 * 用法: npx tsx migrations/run.ts [database_url]
 *
 * 默认连接 teacher_feedback (正式版)
 * 测试版: DATABASE_URL=postgresql://... npx tsx migrations/run.ts
 *
 * 原理:
 * 1. 创建 _migrations 表记录已应用的迁移
 * 2. 按文件名排序读取 migrations/*.sql
 * 3. 跳过已应用的，执行未应用的
 * 4. 每个迁移在一个事务中执行
 */

import { Pool } from 'pg';
import { readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';

const DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://feedback_user:vZd7J7OVOQ2kUygheMCejVbG@localhost:5432/teacher_feedback';

const MIGRATIONS_DIR = __dirname;

async function main() {
  const pool = new Pool({ connectionString: DB_URL });

  try {
    // 1. 创建迁移追踪表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
          name TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // 2. 获取已应用的迁移
    const { rows: applied } = await pool.query(
      'SELECT name FROM _migrations ORDER BY name'
    );
    const appliedSet = new Set(applied.map((r) => r.name));
    console.log(`已应用迁移: ${appliedSet.size} 个`);

    // 3. 读取所有 .sql 文件
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.match(/^\d{3}_.*\.sql$/))
      .sort();

    if (files.length === 0) {
      console.log('没有找到迁移文件');
      return;
    }

    // 4. 执行未应用的迁移
    let ran = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  ✓ ${file} (已应用)`);
        continue;
      }

      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
      console.log(`  → 执行 ${file}...`);

      try {
        await pool.query('BEGIN');
        await pool.query(sql);
        await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await pool.query('COMMIT');
        console.log(`  ✓ ${file} 完成`);
        ran++;
      } catch (err: any) {
        await pool.query('ROLLBACK');
        console.error(`  ✗ ${file} 失败: ${err.message}`);
        throw err;
      }
    }

    if (ran === 0) {
      console.log('数据库已是最新，无需迁移');
    } else {
      console.log(`\n成功执行 ${ran} 个迁移`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('迁移失败:', err.message);
  process.exit(1);
});
