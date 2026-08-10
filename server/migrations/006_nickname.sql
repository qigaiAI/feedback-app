-- ============================================
-- 006: 用户昵称
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT;
