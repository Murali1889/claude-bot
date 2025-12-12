-- Phase 2: Add Classification Fields
-- Adds auto-detected complexity, bug type, and priority fields

-- Add new columns to fix_jobs table
ALTER TABLE fix_jobs
ADD COLUMN IF NOT EXISTS complexity VARCHAR(10) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS bug_type VARCHAR(50) DEFAULT 'other',
ADD COLUMN IF NOT EXISTS priority VARCHAR(5) DEFAULT 'P2',
ADD COLUMN IF NOT EXISTS classification_confidence JSONB DEFAULT '{"complexity": 50, "bugType": 50, "priority": 50}';

-- Add index for filtering by priority and bug type
CREATE INDEX IF NOT EXISTS idx_fix_jobs_priority ON fix_jobs(priority);
CREATE INDEX IF NOT EXISTS idx_fix_jobs_bug_type ON fix_jobs(bug_type);
CREATE INDEX IF NOT EXISTS idx_fix_jobs_complexity ON fix_jobs(complexity);

-- Add comment for documentation
COMMENT ON COLUMN fix_jobs.complexity IS 'Auto-detected fix complexity: simple, medium, complex';
COMMENT ON COLUMN fix_jobs.bug_type IS 'Auto-detected bug type: frontend, backend, database, api, security, etc.';
COMMENT ON COLUMN fix_jobs.priority IS 'Auto-detected priority: P0 (critical), P1 (high), P2 (medium), P3 (low)';
COMMENT ON COLUMN fix_jobs.classification_confidence IS 'Confidence scores (0-100) for each classification';

-- Create a view for job statistics by type and priority
CREATE OR REPLACE VIEW fix_jobs_stats AS
SELECT
  user_id,
  bug_type,
  priority,
  complexity,
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60) FILTER (WHERE status = 'completed') as avg_completion_time_minutes,
  SUM(CASE
    WHEN complexity = 'simple' THEN 0.05
    WHEN complexity = 'medium' THEN 0.34
    WHEN complexity = 'complex' THEN 0.80
    ELSE 0.28
  END) FILTER (WHERE status = 'completed') as total_estimated_cost
FROM fix_jobs
GROUP BY user_id, bug_type, priority, complexity;

COMMENT ON VIEW fix_jobs_stats IS 'Statistics grouped by bug type, priority, and complexity';
