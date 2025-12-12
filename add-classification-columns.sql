-- Add classification columns to fix_jobs table
-- Run this in Supabase SQL Editor

-- Step 1: Add the columns one by one
ALTER TABLE fix_jobs ADD COLUMN IF NOT EXISTS complexity VARCHAR(10);
ALTER TABLE fix_jobs ADD COLUMN IF NOT EXISTS bug_type VARCHAR(50);
ALTER TABLE fix_jobs ADD COLUMN IF NOT EXISTS priority VARCHAR(5);
ALTER TABLE fix_jobs ADD COLUMN IF NOT EXISTS classification_confidence JSONB;

-- Step 2: Set default values for existing rows
UPDATE fix_jobs SET complexity = 'medium' WHERE complexity IS NULL;
UPDATE fix_jobs SET bug_type = 'other' WHERE bug_type IS NULL;
UPDATE fix_jobs SET priority = 'P2' WHERE priority IS NULL;
UPDATE fix_jobs SET classification_confidence = '{"complexity": 50, "bugType": 50, "priority": 50}'::jsonb WHERE classification_confidence IS NULL;

-- Step 3: Set defaults for future inserts
ALTER TABLE fix_jobs ALTER COLUMN complexity SET DEFAULT 'medium';
ALTER TABLE fix_jobs ALTER COLUMN bug_type SET DEFAULT 'other';
ALTER TABLE fix_jobs ALTER COLUMN priority SET DEFAULT 'P2';
ALTER TABLE fix_jobs ALTER COLUMN classification_confidence SET DEFAULT '{"complexity": 50, "bugType": 50, "priority": 50}'::jsonb;

-- Step 4: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_fix_jobs_complexity ON fix_jobs(complexity);
CREATE INDEX IF NOT EXISTS idx_fix_jobs_bug_type ON fix_jobs(bug_type);
CREATE INDEX IF NOT EXISTS idx_fix_jobs_priority ON fix_jobs(priority);

-- Step 5: Verify columns were added
SELECT 'SUCCESS - Columns added!' as status;
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'fix_jobs'
AND column_name IN ('complexity', 'bug_type', 'priority', 'classification_confidence');
