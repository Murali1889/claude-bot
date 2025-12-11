-- Phase 2: Fix Jobs Table
-- Run this in Supabase SQL Editor AFTER phase1-installations.sql

-- ============================================
-- FIX JOBS TABLE
-- Tracks execution of Claude Code CLI fixes
-- ============================================
CREATE TABLE IF NOT EXISTS fix_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    installation_id BIGINT REFERENCES installations(installation_id) ON DELETE SET NULL,

    -- Repository details
    repository_id BIGINT NOT NULL,
    repository_name VARCHAR(255) NOT NULL,
    repository_full_name VARCHAR(500) NOT NULL,

    -- Problem details
    problem_statement TEXT NOT NULL,

    -- Execution status
    status VARCHAR(50) DEFAULT 'pending',
    -- Status values:
    -- 'pending' - Queued for execution
    -- 'running' - Currently executing
    -- 'completed' - Successfully completed
    -- 'failed' - Execution failed

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Results
    branch_name VARCHAR(255),
    pr_number INTEGER,
    pr_url TEXT,

    -- Logs and errors
    execution_log TEXT,
    error_message TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fix_jobs_user_id ON fix_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_fix_jobs_installation_id ON fix_jobs(installation_id);
CREATE INDEX IF NOT EXISTS idx_fix_jobs_status ON fix_jobs(status);
CREATE INDEX IF NOT EXISTS idx_fix_jobs_created_at ON fix_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fix_jobs_repository_full_name ON fix_jobs(repository_full_name);

-- Enable Row Level Security
ALTER TABLE fix_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own jobs
CREATE POLICY "Users can read own fix jobs" ON fix_jobs
    FOR SELECT
    USING (user_id::text = (SELECT id::text FROM users WHERE id = user_id));

-- RLS Policy: Users can create their own jobs
CREATE POLICY "Users can create own fix jobs" ON fix_jobs
    FOR INSERT
    WITH CHECK (user_id::text = (SELECT id::text FROM users WHERE id = user_id));

-- RLS Policy: Users can update their own jobs
CREATE POLICY "Users can update own fix jobs" ON fix_jobs
    FOR UPDATE
    USING (user_id::text = (SELECT id::text FROM users WHERE id = user_id));

-- Trigger to auto-update updated_at
CREATE TRIGGER update_fix_jobs_updated_at BEFORE UPDATE ON fix_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- UPDATE API KEYS TABLE
-- Add token_type field to differentiate between token types
-- ============================================
ALTER TABLE api_keys
ADD COLUMN IF NOT EXISTS token_type VARCHAR(50) DEFAULT 'anthropic_api_key';

-- token_type values:
-- 'claude_code_token' - Claude Code CLI OAuth token (preferred)
-- 'anthropic_api_key' - Direct Anthropic API key

COMMENT ON COLUMN api_keys.token_type IS 'Type of authentication token: claude_code_token or anthropic_api_key';

-- ============================================
-- SAMPLE QUERIES
-- ============================================

-- Get recent fix jobs for a user
-- SELECT
--     fj.id,
--     fj.repository_full_name,
--     fj.problem_statement,
--     fj.status,
--     fj.pr_url,
--     fj.created_at,
--     fj.completed_at
-- FROM fix_jobs fj
-- WHERE fj.user_id = 'USER_UUID_HERE'
-- ORDER BY fj.created_at DESC
-- LIMIT 10;

-- Get pending jobs (for background worker to process)
-- SELECT
--     fj.id,
--     fj.repository_full_name,
--     fj.problem_statement,
--     u.github_username
-- FROM fix_jobs fj
-- JOIN users u ON fj.user_id = u.id
-- WHERE fj.status = 'pending'
-- ORDER BY fj.created_at ASC
-- LIMIT 5;

-- Get job statistics by status
-- SELECT
--     status,
--     COUNT(*) as count,
--     AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
-- FROM fix_jobs
-- WHERE completed_at IS NOT NULL
-- GROUP BY status;
