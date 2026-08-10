-- ============================================
-- 005: feedbacks 表扩展字段
-- ============================================
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS homework TEXT;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS knowledge_text TEXT;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS previous_feedback_id UUID;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS used_template_id UUID;
