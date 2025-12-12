-- RCA Editing Feature Migration
-- Run this in Supabase SQL Editor

-- Step 1: Add RCA editing columns
ALTER TABLE fix_jobs
ADD COLUMN IF NOT EXISTS user_edited_rca TEXT,
ADD COLUMN IF NOT EXISTS rca_edited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS regeneration_count INTEGER DEFAULT 0;

-- Step 2: Ensure branch_name column exists (should already exist, but adding for safety)
-- This column is critical for tracking which branch to reuse during regeneration
ALTER TABLE fix_jobs
ADD COLUMN IF NOT EXISTS branch_name VARCHAR(255);

-- Step 3: Add indexes
CREATE INDEX IF NOT EXISTS idx_fix_jobs_rca_edited ON fix_jobs(rca_edited);
CREATE INDEX IF NOT EXISTS idx_fix_jobs_branch_name ON fix_jobs(branch_name);

-- Step 4: Add comments
COMMENT ON COLUMN fix_jobs.user_edited_rca IS 'User-edited version of the RCA (if edited)';
COMMENT ON COLUMN fix_jobs.rca_edited IS 'Whether the user has edited the RCA';
COMMENT ON COLUMN fix_jobs.regeneration_count IS 'Number of times code was regenerated with edited RCA';
COMMENT ON COLUMN fix_jobs.branch_name IS 'Git branch name for this fix (reused during regeneration)';

-- Step 5: Verify migration
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fix_jobs'
AND column_name IN ('user_edited_rca', 'rca_edited', 'regeneration_count', 'branch_name')
ORDER BY column_name;
