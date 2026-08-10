/**
 * 测试版 → 正式版 数据同步脚本
 *
 * 用法: npx tsx migrations/sync-test-to-prod.ts [--dry-run]
 *
 * 逻辑:
 * - 用户在正式版不存在 → 完整复制用户+数据
 * - 用户已存在 → 合并模式：
 *     • 学生: 按姓名去重，测试版有但正式版没有的才复制
 *     • 班级: 按名称去重
 *     • 反馈: 全部复制（附加到正式版已有数据）
 *     • 模板: 按名称去重
 *
 * --dry-run: 只显示将要执行的操作，不实际修改数据
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const TEST_DB = 'postgresql://feedback_user:vZd7J7OVOQ2kUygheMCejVbG@localhost:5432/teacher_feedback_test';
const PROD_DB = 'postgresql://feedback_user:vZd7J7OVOQ2kUygheMCejVbG@localhost:5432/teacher_feedback';

const DRY_RUN = process.argv.includes('--dry-run');

if (DRY_RUN) {
  console.log('🔍 DRY RUN 模式 — 不会实际修改数据\n');
}

const testDB = new Pool({ connectionString: TEST_DB });
const prodDB = new Pool({ connectionString: PROD_DB });

interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  membership_type: string;
  style_prompt: string | null;
  email_verified: boolean;
  verification_token: string | null;
  verification_token_expires: string | null;
  nickname: string | null;
  template_limit: number;
  created_at: string;
  updated_at: string;
}

async function main() {
  // 1. 获取测试版所有用户
  const { rows: testUsers } = await testDB.query<User>(
    'SELECT * FROM users ORDER BY created_at'
  );
  console.log(`测试版用户: ${testUsers.length} 个`);

  // 2. 获取正式版用户邮箱映射
  const { rows: prodUsers } = await prodDB.query<User>(
    'SELECT * FROM users'
  );
  const prodEmailMap = new Map(prodUsers.map((u) => [u.email, u]));
  console.log(`正式版用户: ${prodUsers.length} 个\n`);

  for (const testUser of testUsers) {
    const prodUser = prodEmailMap.get(testUser.email);

    if (!prodUser) {
      // === 新用户：完整复制 ===
      console.log(`📦 ${testUser.email} — 正式版中不存在，完整复制`);
      await copyFullUser(testUser);
    } else {
      // === 已存在用户：合并数据 ===
      console.log(`🔀 ${testUser.email} — 正式版已存在，合并数据`);
      await mergeUserData(testUser, prodUser);
    }
  }

  console.log('\n✅ 同步完成');
  if (DRY_RUN) console.log('(以上为预演，未实际修改数据)');
}

async function copyFullUser(testUser: User) {
  // 创建新 UUID 映射
  const newUserId = randomUUID();
  const studentMap = new Map<string, string>(); // old_id → new_id
  const groupMap = new Map<string, string>();

  // 获取测试版用户数据
  const students = await testDB.query(
    'SELECT * FROM students WHERE teacher_id=$1', [testUser.id]
  );
  const groups = await testDB.query(
    'SELECT * FROM groups WHERE teacher_id=$1', [testUser.id]
  );
  const sgs = await testDB.query(
    'SELECT student_id, group_id FROM student_groups WHERE student_id IN (SELECT id FROM students WHERE teacher_id=$1)',
    [testUser.id]
  );
  const feedbacks = await testDB.query(
    'SELECT * FROM feedbacks WHERE teacher_id=$1', [testUser.id]
  );
  const templates = await testDB.query(
    'SELECT * FROM templates WHERE teacher_id=$1', [testUser.id]
  );

  console.log(`  用户: 1 | 学生: ${students.rows.length} | 班级: ${groups.rows.length} | 反馈: ${feedbacks.rows.length} | 模板: ${templates.rows.length}`);

  if (DRY_RUN) return;

  // 创建用户
  await prodDB.query(
    `INSERT INTO users (id, email, password_hash, name, role, membership_type, style_prompt,
      email_verified, verification_token, verification_token_expires, nickname, template_limit, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [newUserId, testUser.email, testUser.password_hash, testUser.name, testUser.role,
     testUser.membership_type, testUser.style_prompt, testUser.email_verified,
     testUser.verification_token, testUser.verification_token_expires, testUser.nickname,
     testUser.template_limit, testUser.created_at, testUser.updated_at]
  );

  // 复制学生
  for (const s of students.rows) {
    const newId = randomUUID();
    studentMap.set(s.id, newId);
    await prodDB.query(
      'INSERT INTO students (id, teacher_id, name, grade, notes, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [newId, newUserId, s.name, s.grade, s.notes, s.created_at, s.updated_at]
    );
  }

  // 复制班级
  for (const g of groups.rows) {
    const newId = randomUUID();
    groupMap.set(g.id, newId);
    await prodDB.query(
      'INSERT INTO groups (id, teacher_id, name, created_at) VALUES ($1,$2,$3,$4)',
      [newId, newUserId, g.name, g.created_at]
    );
  }

  // 复制学生-班级关联
  for (const sg of sgs.rows) {
    const ns = studentMap.get(sg.student_id);
    const ng = groupMap.get(sg.group_id);
    if (ns && ng) {
      await prodDB.query(
        'INSERT INTO student_groups (student_id, group_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [ns, ng]
      );
    }
  }

  // 复制反馈
  for (const f of feedbacks.rows) {
    const ns = studentMap.get(f.student_id);
    if (!ns) continue;
    await prodDB.query(
      `INSERT INTO feedbacks (teacher_id, student_id, content, raw_input, used_tags, is_deleted,
        created_at, updated_at, homework, knowledge_text, previous_feedback_id, used_template_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [newUserId, ns, f.content, f.raw_input, f.used_tags, f.is_deleted,
       f.created_at, f.updated_at, f.homework, f.knowledge_text, f.previous_feedback_id, f.used_template_id]
    );
  }

  // 复制模板
  for (const t of templates.rows) {
    await prodDB.query(
      'INSERT INTO templates (teacher_id, name, style_prompt, is_default, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [newUserId, t.name, t.style_prompt, t.is_default, t.created_at, t.updated_at]
    );
  }
}

async function mergeUserData(testUser: User, prodUser: User) {
  // 获取测试版数据
  const tStudents = await testDB.query('SELECT * FROM students WHERE teacher_id=$1', [testUser.id]);
  const tGroups = await testDB.query('SELECT * FROM groups WHERE teacher_id=$1', [testUser.id]);
  const tTemplates = await testDB.query('SELECT * FROM templates WHERE teacher_id=$1', [testUser.id]);
  const tFeedbacks = await testDB.query('SELECT * FROM feedbacks WHERE teacher_id=$1', [testUser.id]);
  const tSgs = await testDB.query(
    'SELECT student_id, group_id FROM student_groups WHERE student_id IN (SELECT id FROM students WHERE teacher_id=$1)',
    [testUser.id]
  );

  // 获取正式版已有数据
  const pStudents = await prodDB.query('SELECT * FROM students WHERE teacher_id=$1', [prodUser.id]);
  const pGroups = await prodDB.query('SELECT * FROM groups WHERE teacher_id=$1', [prodUser.id]);
  const pTemplates = await prodDB.query('SELECT * FROM templates WHERE teacher_id=$1', [prodUser.id]);
  const pFeedbacks = await prodDB.query('SELECT * FROM feedbacks WHERE teacher_id=$1', [prodUser.id]);

  // 姓名集合（用于去重）
  const pStudentNames = new Set(pStudents.rows.map((s: any) => s.name));
  const pGroupNames = new Set(pGroups.rows.map((g: any) => g.name));
  const pTemplateNames = new Set(pTemplates.rows.map((t: any) => t.name));

  let newStudents = 0, newGroups = 0, newTemplates = 0, newFeedbacks = 0;

  const studentMap = new Map<string, string>(); // test_id → prod_id (for new students)
  const groupMap = new Map<string, string>();

  // 同步学生（DRY_RUN 也生成映射以准确计数）
  for (const s of tStudents.rows) {
    if (pStudentNames.has(s.name)) continue; // 已存在，跳过
    const newId = DRY_RUN ? 'dry-run-' + s.id : randomUUID();
    studentMap.set(s.id, newId);
    if (!DRY_RUN) {
      await prodDB.query(
        'INSERT INTO students (id, teacher_id, name, grade, notes, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [newId, prodUser.id, s.name, s.grade, s.notes, s.created_at, s.updated_at]
      );
    }
    newStudents++;
  }

  // 同步班级
  for (const g of tGroups.rows) {
    if (pGroupNames.has(g.name)) continue;
    const newId = DRY_RUN ? 'dry-run-' + g.id : randomUUID();
    groupMap.set(g.id, newId);
    if (!DRY_RUN) {
      await prodDB.query(
        'INSERT INTO groups (id, teacher_id, name, created_at) VALUES ($1,$2,$3,$4)',
        [newId, prodUser.id, g.name, g.created_at]
      );
    }
    newGroups++;
  }

  // 同步模板
  for (const t of tTemplates.rows) {
    if (pTemplateNames.has(t.name)) continue;
    if (!DRY_RUN) {
      await prodDB.query(
        'INSERT INTO templates (teacher_id, name, style_prompt, is_default, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)',
        [prodUser.id, t.name, t.style_prompt, t.is_default, t.created_at, t.updated_at]
      );
    }
    newTemplates++;
  }

  // 构建正式版学生姓名→ID映射（已有 + 新复制）
  const pStudentNameToId = new Map<string, string>();
  for (const s of pStudents.rows) {
    pStudentNameToId.set(s.name, s.id);
  }
  for (const [testId, prodId] of studentMap) {
    const ts = tStudents.rows.find((s: any) => s.id === testId);
    if (ts) pStudentNameToId.set(ts.name, prodId);
  }

  // 构建正式版已有反馈的键集合（用于去重）
  const pFeedbackKeys = new Set<string>();
  for (const f of pFeedbacks.rows) {
    // 去重键: student_name|created_at|content前50字
    const s = pStudents.rows.find((ps: any) => ps.id === f.student_id);
    const key = `${s?.name || ''}|${f.created_at}|${(f.content || '').slice(0, 50)}`;
    pFeedbackKeys.add(key);
  }

  // 同步反馈
  for (const f of tFeedbacks.rows) {
    const tStudent = tStudents.rows.find((s: any) => s.id === f.student_id);
    if (!tStudent) continue;
    const prodStudentId = pStudentNameToId.get(tStudent.name);
    if (!prodStudentId) continue;

    // 去重检查
    const dupKey = `${tStudent.name}|${f.created_at}|${(f.content || '').slice(0, 50)}`;
    if (pFeedbackKeys.has(dupKey)) continue;
    pFeedbackKeys.add(dupKey); // 避免同批次重复

    if (DRY_RUN) { newFeedbacks++; continue; }
    await prodDB.query(
      `INSERT INTO feedbacks (teacher_id, student_id, content, raw_input, used_tags, is_deleted,
        created_at, updated_at, homework, knowledge_text, previous_feedback_id, used_template_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [prodUser.id, prodStudentId, f.content, f.raw_input, f.used_tags, f.is_deleted,
       f.created_at, f.updated_at, f.homework, f.knowledge_text, f.previous_feedback_id, f.used_template_id]
    );
    newFeedbacks++;
  }

  // 同步学生-班级关联（仅对新复制的学生+班级）
  for (const sg of tSgs.rows) {
    const ns = studentMap.get(sg.student_id);
    const ng = groupMap.get(sg.group_id);
    if (ns && ng && !DRY_RUN) {
      await prodDB.query(
        'INSERT INTO student_groups (student_id, group_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [ns, ng]
      );
    }
  }

  // 同步 template_limit（取最大值）
  if (testUser.template_limit > prodUser.template_limit && !DRY_RUN) {
    await prodDB.query('UPDATE users SET template_limit=$1 WHERE id=$2',
      [testUser.template_limit, prodUser.id]);
  }

  console.log(`  新增: 学生 ${newStudents} | 班级 ${newGroups} | 反馈 ${newFeedbacks} | 模板 ${newTemplates}`);
}

main().catch((err) => {
  console.error('同步失败:', err);
  process.exit(1);
}).finally(async () => {
  await testDB.end();
  await prodDB.end();
});
