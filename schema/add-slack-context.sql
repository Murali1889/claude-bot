-- Add Slack Context Support
-- Stores Slack thread/channel context for fix jobs triggered from Slack

-- Add slack_context column to fix_jobs table
ALTER TABLE fix_jobs
ADD COLUMN IF NOT EXISTS slack_context JSONB;

-- Add index for querying by slack thread
CREATE INDEX IF NOT EXISTS idx_fix_jobs_slack_thread ON fix_jobs ((slack_context->>'thread_ts'));

-- Add index for querying by slack channel
CREATE INDEX IF NOT EXISTS idx_fix_jobs_slack_channel ON fix_jobs ((slack_context->>'channel_id'));

-- Comment explaining the column
COMMENT ON COLUMN fix_jobs.slack_context IS 'Slack context (thread_ts, channel_id, user_id, etc.) for jobs triggered from Slack';

-- Example slack_context structure:
-- {
--   "thread_ts": "1234567890.123456",
--   "channel_id": "C01234567",
--   "channel_name": "#engineering",
--   "user_id": "U01234567",
--   "user_name": "john.doe",
--   "team_id": "T01234567",
--   "team_domain": "acme-corp",
--   "message_ts": "1234567890.123456",
--   "permalink": "https://acme-corp.slack.com/archives/C01234567/p1234567890123456"
-- }
