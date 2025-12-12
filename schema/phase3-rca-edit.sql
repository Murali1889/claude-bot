-- Phase 3: RCA Editing and Re-run
-- Allows users to edit RCA and regenerate code changes

-- Add RCA editing fields to fix_jobs table
ALTER TABLE fix_jobs
ADD COLUMN IF NOT EXISTS user_edited_rca TEXT,
ADD COLUMN IF NOT EXISTS rca_edited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS regeneration_count INTEGER DEFAULT 0;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_fix_jobs_rca_edited ON fix_jobs(rca_edited);

-- Add comments
COMMENT ON COLUMN fix_jobs.user_edited_rca IS 'User-edited version of the RCA (if edited)';
COMMENT ON COLUMN fix_jobs.rca_edited IS 'Whether the user has edited the RCA';
COMMENT ON COLUMN fix_jobs.regeneration_count IS 'Number of times code was regenerated with edited RCA';
