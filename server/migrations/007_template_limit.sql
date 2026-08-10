-- ============================================
-- 007: 模板数量限制
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS template_limit INTEGER NOT NULL DEFAULT 3;
