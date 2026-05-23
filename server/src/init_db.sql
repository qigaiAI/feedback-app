-- ============================================
-- 教培老师课后反馈系统 - 数据库初始化
-- ============================================

-- 扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin')),
    membership_type TEXT NOT NULL DEFAULT 'free',
    style_prompt TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. students
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    grade TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. groups
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. student_groups
CREATE TABLE IF NOT EXISTS student_groups (
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (student_id, group_id)
);

-- 5. feedbacks
CREATE TABLE IF NOT EXISTS feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    raw_input JSONB,
    used_tags UUID[],
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. knowledge_tags
CREATE TABLE IF NOT EXISTS knowledge_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level INT NOT NULL CHECK (level IN (1, 2, 3, 4)),
    name TEXT NOT NULL,
    parent_id UUID REFERENCES knowledge_tags(id) ON DELETE CASCADE,
    order_num INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. behavior_tags
CREATE TABLE IF NOT EXISTS behavior_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 种子数据：知识标签树 (K12 数学/语文/英语)
-- ============================================

-- 学段 (level=1)
INSERT INTO knowledge_tags (id, level, name, order_num) VALUES
  (gen_random_uuid(), 1, '小学', 1),
  (gen_random_uuid(), 1, '初中', 2),
  (gen_random_uuid(), 1, '高中', 3)
ON CONFLICT DO NOTHING;

-- 获取学段ID
DO $$
DECLARE
  primary_id UUID; middle_id UUID; high_id UUID;
  math_p UUID; chinese_p UUID; english_p UUID;
  math_m UUID; chinese_m UUID; english_m UUID;
  math_h UUID; chinese_h UUID; english_h UUID;
BEGIN
  SELECT id INTO primary_id FROM knowledge_tags WHERE name = '小学' AND level = 1;
  SELECT id INTO middle_id FROM knowledge_tags WHERE name = '初中' AND level = 1;
  SELECT id INTO high_id FROM knowledge_tags WHERE name = '高中' AND level = 1;

  -- 学科 (level=2) - 小学
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 2, '数学', primary_id, 1) RETURNING id INTO math_p;
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 2, '语文', primary_id, 2) RETURNING id INTO chinese_p;
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 2, '英语', primary_id, 3) RETURNING id INTO english_p;

  -- 学科 (level=2) - 初中
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 2, '数学', middle_id, 1) RETURNING id INTO math_m;
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 2, '语文', middle_id, 2) RETURNING id INTO chinese_m;
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 2, '英语', middle_id, 3) RETURNING id INTO english_m;

  -- 学科 (level=2) - 高中
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 2, '数学', high_id, 1) RETURNING id INTO math_h;
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 2, '语文', high_id, 2) RETURNING id INTO chinese_h;
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 2, '英语', high_id, 3) RETURNING id INTO english_h;

  -- ============ 小学 ============

  -- 小学数学 专题 (level=3)
  WITH t AS (
    INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
      (gen_random_uuid(), 3, '数与运算', math_p, 1),
      (gen_random_uuid(), 3, '几何图形', math_p, 2),
      (gen_random_uuid(), 3, '应用题', math_p, 3),
      (gen_random_uuid(), 3, '统计与概率', math_p, 4)
    RETURNING id, name
  )
  -- 知识点 (level=4)
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, kp.name, t.id, kp.ord
  FROM t, (VALUES ('加减法运算', 1), ('乘除法运算', 2), ('分数初步', 3), ('小数认识', 4)) AS kp(name, ord)
  WHERE t.name = '数与运算';

  WITH t AS (
    INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
      (gen_random_uuid(), 3, '数与运算', math_p, 1)
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, n, t.id, o
  FROM t, (VALUES ('加减法运算', 1), ('乘除法运算', 2), ('分数初步', 3), ('小数认识', 4)) AS v(n, o);

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = math_p AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('加减法运算', 1), ('乘除法运算', 2), ('分数初步', 3), ('小数认识', 4)
  ) AS v(n, o)
  WHERE t.name = '数与运算';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = math_p AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('长方形与正方形', 1), ('三角形', 2), ('面积计算', 3), ('体积初步', 4)
  ) AS v(n, o)
  WHERE t.name = '几何图形';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = math_p AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('一步应用题', 1), ('两步应用题', 2), ('归一问题', 3)
  ) AS v(n, o)
  WHERE t.name = '应用题';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = math_p AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('数据收集', 1), ('平均数', 2), ('可能性', 3)
  ) AS v(n, o)
  WHERE t.name = '统计与概率';

  -- 小学语文 专题 (level=3)
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 3, '拼音与识字', chinese_p, 1),
    (gen_random_uuid(), 3, '阅读', chinese_p, 2),
    (gen_random_uuid(), 3, '写作', chinese_p, 3);

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = chinese_p AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('声母韵母', 1), ('整体认读', 2), ('多音字', 3)
  ) AS v(n, o)
  WHERE t.name = '拼音与识字';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = chinese_p AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('课文理解', 1), ('古诗背诵', 2), ('阅读理解', 3)
  ) AS v(n, o)
  WHERE t.name = '阅读';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = chinese_p AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('看图写话', 1), ('日记写作', 2), ('命题作文', 3)
  ) AS v(n, o)
  WHERE t.name = '写作';

  -- 小学英语 专题 (level=3)
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 3, '词汇', english_p, 1),
    (gen_random_uuid(), 3, '语法', english_p, 2),
    (gen_random_uuid(), 3, '听说', english_p, 3);

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = english_p AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('日常词汇', 1), ('颜色数字', 2), ('动物食物', 3)
  ) AS v(n, o)
  WHERE t.name = '词汇';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = english_p AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('be动词', 1), ('一般现在时', 2), ('疑问句', 3)
  ) AS v(n, o)
  WHERE t.name = '语法';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = english_p AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('日常对话', 1), ('自我介绍', 2), ('简单听力', 3)
  ) AS v(n, o)
  WHERE t.name = '听说';

  -- ============ 初中 ============

  -- 初中数学 专题
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 3, '代数', math_m, 1),
    (gen_random_uuid(), 3, '几何', math_m, 2),
    (gen_random_uuid(), 3, '函数', math_m, 3);

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = math_m AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('一元一次方程', 1), ('二元一次方程组', 2), ('不等式', 3), ('整式运算', 4)
  ) AS v(n, o)
  WHERE t.name = '代数';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = math_m AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('三角形全等', 1), ('四边形', 2), ('圆', 3), ('相似', 4)
  ) AS v(n, o)
  WHERE t.name = '几何';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = math_m AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('一次函数', 1), ('二次函数', 2), ('反比例函数', 3)
  ) AS v(n, o)
  WHERE t.name = '函数';

  -- 初中语文 专题
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 3, '文言文', chinese_m, 1),
    (gen_random_uuid(), 3, '现代文阅读', chinese_m, 2),
    (gen_random_uuid(), 3, '作文', chinese_m, 3);

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = chinese_m AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('实词虚词', 1), ('翻译', 2), ('背诵', 3)
  ) AS v(n, o)
  WHERE t.name = '文言文';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = chinese_m AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('记叙文', 1), ('说明文', 2), ('议论文', 3)
  ) AS v(n, o)
  WHERE t.name = '现代文阅读';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = chinese_m AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('记叙文写作', 1), ('议论文写作', 2), ('材料作文', 3)
  ) AS v(n, o)
  WHERE t.name = '作文';

  -- 初中英语 专题
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 3, '词汇', english_m, 1),
    (gen_random_uuid(), 3, '语法', english_m, 2),
    (gen_random_uuid(), 3, '完形阅读', english_m, 3);

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = english_m AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('中考词汇', 1), ('短语搭配', 2), ('词性转换', 3)
  ) AS v(n, o)
  WHERE t.name = '词汇';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = english_m AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('时态', 1), ('被动语态', 2), ('从句', 3), ('情态动词', 4)
  ) AS v(n, o)
  WHERE t.name = '语法';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = english_m AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('完形填空', 1), ('阅读理解', 2), ('任务型阅读', 3)
  ) AS v(n, o)
  WHERE t.name = '完形阅读';

  -- ============ 高中 ============

  -- 高中数学 专题
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 3, '函数与导数', math_h, 1),
    (gen_random_uuid(), 3, '解析几何', math_h, 2),
    (gen_random_uuid(), 3, '概率统计', math_h, 3);

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = math_h AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('函数性质', 1), ('导数应用', 2), ('三角函数', 3), ('数列', 4)
  ) AS v(n, o)
  WHERE t.name = '函数与导数';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = math_h AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('直线与圆', 1), ('椭圆', 2), ('双曲线', 3), ('抛物线', 4)
  ) AS v(n, o)
  WHERE t.name = '解析几何';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = math_h AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('排列组合', 1), ('二项式定理', 2), ('概率分布', 3)
  ) AS v(n, o)
  WHERE t.name = '概率统计';

  -- 高中语文 专题
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 3, '古诗文', chinese_h, 1),
    (gen_random_uuid(), 3, '现代文', chinese_h, 2),
    (gen_random_uuid(), 3, '写作', chinese_h, 3);

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = chinese_h AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('诗词鉴赏', 1), ('文言文阅读', 2), ('名句默写', 3)
  ) AS v(n, o)
  WHERE t.name = '古诗文';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = chinese_h AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('论述类文本', 1), ('文学类文本', 2), ('实用类文本', 3)
  ) AS v(n, o)
  WHERE t.name = '现代文';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = chinese_h AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('议论文', 1), ('记叙文', 2), ('任务驱动型作文', 3)
  ) AS v(n, o)
  WHERE t.name = '写作';

  -- 高中英语 专题
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num) VALUES
    (gen_random_uuid(), 3, '词汇', english_h, 1),
    (gen_random_uuid(), 3, '语法', english_h, 2),
    (gen_random_uuid(), 3, '题型训练', english_h, 3);

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = english_h AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('高考核心词', 1), ('熟词生义', 2), ('词块搭配', 3)
  ) AS v(n, o)
  WHERE t.name = '词汇';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = english_h AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('非谓语动词', 1), ('虚拟语气', 2), ('倒装句', 3), ('定语从句', 4)
  ) AS v(n, o)
  WHERE t.name = '语法';

  WITH t AS (
    SELECT id, name FROM knowledge_tags WHERE parent_id = english_h AND level = 3
  )
  INSERT INTO knowledge_tags (id, level, name, parent_id, order_num)
  SELECT gen_random_uuid(), 4, v.n, t.id, v.o
  FROM t, (VALUES
    ('阅读理解', 1), ('完形填空', 2), ('书面表达', 3), ('语法填空', 4)
  ) AS v(n, o)
  WHERE t.name = '题型训练';

END $$;

-- ============================================
-- 种子数据：默认行为标签
-- ============================================
INSERT INTO behavior_tags (id, teacher_id, name) VALUES
  (gen_random_uuid(), NULL, '积极发言'),
  (gen_random_uuid(), NULL, '走神'),
  (gen_random_uuid(), NULL, '小动作多'),
  (gen_random_uuid(), NULL, '勇于提问'),
  (gen_random_uuid(), NULL, '作业完成优秀'),
  (gen_random_uuid(), NULL, '速度偏慢')
ON CONFLICT DO NOTHING;

-- 索引
CREATE INDEX IF NOT EXISTS idx_students_teacher ON students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_groups_teacher ON groups(teacher_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_teacher ON feedbacks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_student ON feedbacks(student_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created ON feedbacks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_tags_parent ON knowledge_tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_tags_level ON knowledge_tags(level);
CREATE INDEX IF NOT EXISTS idx_behavior_tags_teacher ON behavior_tags(teacher_id);
