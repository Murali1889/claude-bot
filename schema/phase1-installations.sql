-- Phase 1: Installations Table
-- Run this in Supabase SQL Editor AFTER phase1-auth.sql

-- ============================================
-- INSTALLATIONS TABLE
-- Stores GitHub App installations linked to users
-- ============================================
CREATE TABLE IF NOT EXISTS installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id BIGINT UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_login VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- 'User' or 'Organization'
    account_id BIGINT NOT NULL,
    repository_selection VARCHAR(50) DEFAULT 'all', -- 'all' or 'selected'
    suspended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_installations_installation_id ON installations(installation_id);
CREATE INDEX IF NOT EXISTS idx_installations_user_id ON installations(user_id);
CREATE INDEX IF NOT EXISTS idx_installations_account_id ON installations(account_id);

-- Enable Row Level Security
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own installations
CREATE POLICY "Users can read own installations" ON installations
    FOR SELECT
    USING (user_id::text = (SELECT id::text FROM users WHERE id = user_id));

-- Function to update updated_at timestamp
CREATE TRIGGER update_installations_updated_at BEFORE UPDATE ON installations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INSTALLATION_REPOSITORIES TABLE (Optional)
-- Track which specific repos are installed (for selected mode)
-- ============================================
CREATE TABLE IF NOT EXISTS installation_repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id BIGINT REFERENCES installations(installation_id) ON DELETE CASCADE,
    repository_id BIGINT NOT NULL,
    repository_name VARCHAR(255) NOT NULL,
    repository_full_name VARCHAR(500) NOT NULL,
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(installation_id, repository_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_installation_repos_installation_id
    ON installation_repositories(installation_id);
CREATE INDEX IF NOT EXISTS idx_installation_repos_repository_id
    ON installation_repositories(repository_id);
