-- Check current columns in fix_jobs table
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'fix_jobs'
ORDER BY ordinal_position;

-- Check if the new columns exist
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fix_jobs' AND column_name = 'complexity') as has_complexity,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fix_jobs' AND column_name = 'bug_type') as has_bug_type,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fix_jobs' AND column_name = 'priority') as has_priority,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fix_jobs' AND column_name = 'classification_confidence') as has_classification_confidence;
