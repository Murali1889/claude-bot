-- ============================================
-- Supabase Schema for Claude Bot
-- Run this in the Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- Stores GitHub users who install the app
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_user_id BIGINT UNIQUE NOT NULL,
    github_username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    avatar_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup by GitHub ID
CREATE INDEX IF NOT EXISTS idx_users_github_user_id ON users(github_user_id);

-- ============================================
-- INSTALLATIONS TABLE
-- Stores GitHub App installations
-- ============================================
CREATE TABLE IF NOT EXISTS installations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    installation_id BIGINT UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    account_login VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- 'User' or 'Organization'
    account_id BIGINT NOT NULL,
    suspended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_installations_installation_id ON installations(installation_id);
CREATE INDEX IF NOT EXISTS idx_installations_user_id ON installations(user_id);
CREATE INDEX IF NOT EXISTS idx_installations_account_id ON installations(account_id);

-- ============================================
-- API KEYS TABLE
-- Stores encrypted Anthropic API keys
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    installation_id BIGINT UNIQUE NOT NULL REFERENCES installations(installation_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    encrypted_key TEXT NOT NULL,
    key_iv VARCHAR(64) NOT NULL, -- Base64 encoded IV
    key_auth_tag VARCHAR(64) NOT NULL, -- Base64 encoded auth tag
    key_prefix VARCHAR(20), -- e.g., "sk-ant-api03-..."
    key_type VARCHAR(50) DEFAULT 'api_key', -- 'api_key' or 'oauth_token'
    key_status VARCHAR(50) DEFAULT 'active', -- 'active', 'invalid', 'expired', 'rate_limited'
    failure_count INTEGER DEFAULT 0,
    failure_reason TEXT,
    last_used_at TIMESTAMPTZ,
    last_validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_installation_id ON api_keys(installation_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(key_status);

-- ============================================
-- NOTIFICATION SETTINGS TABLE
-- Stores user notification preferences
-- ============================================
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT TRUE,
    email_address VARCHAR(255),
    github_issue_enabled BOOLEAN DEFAULT TRUE,
    slack_enabled BOOLEAN DEFAULT FALSE,
    slack_webhook_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);

-- ============================================
-- ALERT HISTORY TABLE
-- Logs alerts sent to users
-- ============================================
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    installation_id BIGINT,
    alert_type VARCHAR(50) NOT NULL, -- 'key_invalid', 'key_expired', 'rate_limited'
    channel VARCHAR(50) NOT NULL, -- 'email', 'github_issue', 'slack'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    message TEXT,
    error_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alert_history_user_id ON alert_history(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_installation_id ON alert_history(installation_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history(created_at);

-- ============================================
-- USAGE LOGS TABLE (Optional - for analytics)
-- Tracks API usage per installation
-- ============================================
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    installation_id BIGINT NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'trigger', 'success', 'failure'
    repo_full_name VARCHAR(255),
    issue_number INTEGER,
    triggered_by VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_usage_logs_installation_id ON usage_logs(installation_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_event_type ON usage_logs(event_type);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_installations_updated_at
    BEFORE UPDATE ON installations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at
    BEFORE UPDATE ON notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enable when using with authenticated users
-- ============================================

-- Enable RLS on all tables (uncomment when ready)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE installations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SAMPLE QUERIES
-- ============================================

-- Get installation with user and API key status
-- SELECT
--     i.installation_id,
--     i.account_login,
--     u.github_username,
--     ak.key_prefix,
--     ak.key_status,
--     ak.last_validated_at
-- FROM installations i
-- LEFT JOIN users u ON i.user_id = u.id
-- LEFT JOIN api_keys ak ON i.installation_id = ak.installation_id
-- WHERE i.installation_id = 12345;

-- Get all installations missing API keys
-- SELECT
--     i.installation_id,
--     i.account_login,
--     i.created_at
-- FROM installations i
-- LEFT JOIN api_keys ak ON i.installation_id = ak.installation_id
-- WHERE ak.id IS NULL;

-- Get installations with failing API keys
-- SELECT
--     i.installation_id,
--     i.account_login,
--     ak.key_status,
--     ak.failure_count,
--     ak.failure_reason
-- FROM installations i
-- JOIN api_keys ak ON i.installation_id = ak.installation_id
-- WHERE ak.key_status != 'active' OR ak.failure_count > 0;
