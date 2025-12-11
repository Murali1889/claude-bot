# Implementation Plan: User Authentication & API Key Management

## Overview

Add secure API key management so users don't need to configure `ANTHROPIC_API_KEY` in their repo secrets. Users will paste their API key on a setup page after GitHub App installation.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
  │   User       │         │   GitHub     │         │   Vercel     │
  │   installs   │ ──────► │   redirects  │ ──────► │   Setup      │
  │   GitHub App │         │   to setup   │         │   Page       │
  └──────────────┘         │   URL        │         └──────┬───────┘
                           └──────────────┘                │
                                                           │
                                                           ▼
  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
  │   Webhook    │         │   Supabase   │ ◄────── │   User       │
  │   receives   │ ◄────── │   stores     │         │   enters     │
  │   install    │         │   encrypted  │         │   API key    │
  │   event      │         │   key        │         └──────────────┘
  └──────────────┘         └──────────────┘

                    WHEN USER TRIGGERS @claude

  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
  │   Issue      │         │   Webhook    │         │   Supabase   │
  │   comment    │ ──────► │   handler    │ ──────► │   fetch &    │
  │   @claude    │         │   receives   │         │   decrypt    │
  └──────────────┘         └──────────────┘         │   API key    │
                                  │                 └──────────────┘
                                  │
                                  ▼
  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
  │   PR         │ ◄────── │   Claude     │ ◄────── │   GitHub     │
  │   created    │         │   fixes      │         │   Actions    │
  │              │         │   code       │         │   workflow   │
  └──────────────┘         └──────────────┘         └──────────────┘

                    ON API KEY FAILURE

  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
  │   Alert      │ ──────► │   Email      │         │   Slack      │
  │   Service    │ ──────► │   (SendGrid) │         │   webhook    │
  │   triggered  │ ──────► │   GitHub     │ ──────► │   (optional) │
  └──────────────┘         │   Issue      │         └──────────────┘
                           └──────────────┘
```

---

## Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Setup Frontend | Vercel (Next.js) | API key input page, user dashboard |
| Database | Supabase (PostgreSQL) | Encrypted keys, user-installation mappings |
| Encryption | AES-256-GCM | Encrypt API keys at rest |
| Alerts | SendGrid + Slack | Notify on key failures |

---

## Database Schema (Supabase)

### Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     users       │       │  installations  │       │    api_keys     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄──┐   │ id (PK)         │       │ id (PK)         │
│ github_user_id  │   │   │ installation_id │◄──────│ installation_id │
│ github_username │   └───│ user_id (FK)    │   ┌───│ user_id (FK)    │
│ email           │       │ account_login   │   │   │ encrypted_key   │
│ created_at      │       │ account_type    │   │   │ key_iv          │
└─────────────────┘       │ created_at      │   │   │ key_auth_tag    │
        ▲                 └─────────────────┘   │   │ key_status      │
        │                                       │   │ failure_count   │
        │                                       │   └─────────────────┘
        │                 ┌─────────────────┐   │
        │                 │ notification_   │   │
        │                 │ settings        │   │
        │                 ├─────────────────┤   │
        └─────────────────│ user_id (FK)    │◄──┘
                          │ email_enabled   │
                          │ slack_enabled   │
                          │ slack_webhook   │
                          └─────────────────┘
```

### SQL Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_user_id BIGINT UNIQUE NOT NULL,
    github_username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Installations table
CREATE TABLE installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id BIGINT UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_login VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys table (encrypted)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id BIGINT UNIQUE REFERENCES installations(installation_id),
    user_id UUID REFERENCES users(id),
    encrypted_key TEXT NOT NULL,
    key_iv VARCHAR(32) NOT NULL,
    key_auth_tag VARCHAR(32) NOT NULL,
    key_prefix VARCHAR(20),
    key_status VARCHAR(50) DEFAULT 'active',
    failure_count INTEGER DEFAULT 0,
    last_validated_at TIMESTAMPTZ
);

-- Notification Settings table
CREATE TABLE notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id),
    email_enabled BOOLEAN DEFAULT TRUE,
    email_address VARCHAR(255),
    github_issue_enabled BOOLEAN DEFAULT TRUE,
    slack_enabled BOOLEAN DEFAULT FALSE,
    slack_webhook_url TEXT
);

-- Indexes for performance
CREATE INDEX idx_users_github_id ON users(github_user_id);
CREATE INDEX idx_installations_id ON installations(installation_id);
CREATE INDEX idx_api_keys_installation ON api_keys(installation_id);
CREATE INDEX idx_api_keys_status ON api_keys(key_status);
```

---

## File Structure

### Backend Changes (claude-bot/)

```
claude-bot/
├── webhook-handler.js          # MODIFY: Add installation handlers, API key fetching
├── package.json                # MODIFY: Add new dependencies
├── .env.example                # MODIFY: Add new env vars
├── lib/
│   ├── encryption.js           # NEW: AES-256-GCM encrypt/decrypt
│   ├── supabase.js             # NEW: Supabase client setup
│   ├── api-key-service.js      # NEW: API key management
│   └── alert-service.js        # NEW: Email, Slack, GitHub Issue alerts
├── schema/
│   └── supabase.sql            # NEW: Database schema
└── .github/
    └── workflows/
        └── worker.yml          # MODIFY: Use API key from payload
```

### Frontend (new repo: claude-bot-setup/)

```
claude-bot-setup/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                # Landing page
│   ├── setup/
│   │   └── page.tsx            # API key input form
│   ├── dashboard/
│   │   └── page.tsx            # User dashboard
│   └── api/
│       ├── auth/
│       │   └── github/
│       │       └── route.ts    # GitHub OAuth
│       ├── api-key/
│       │   ├── route.ts        # Save encrypted key
│       │   └── validate/
│       │       └── route.ts    # Validate with Anthropic
│       └── webhook/
│           └── route.ts        # Receive alerts
├── lib/
│   ├── supabase-client.ts
│   ├── supabase-server.ts
│   └── encryption.ts
├── components/
│   ├── ApiKeyForm.tsx
│   └── NotificationSettings.tsx
└── package.json
```

---

## Implementation Phases

### Phase 1: Database & Encryption (Backend)

| Task | File | Description |
|------|------|-------------|
| 1.1 | `lib/encryption.js` | Create AES-256-GCM encrypt/decrypt functions |
| 1.2 | `lib/supabase.js` | Create Supabase client with service key |
| 1.3 | `lib/api-key-service.js` | Create functions to fetch, save, validate keys |
| 1.4 | `schema/supabase.sql` | Create SQL schema file |

### Phase 2: Webhook Handler Updates

| Task | File | Description |
|------|------|-------------|
| 2.1 | `webhook-handler.js` | Add `installation.created` webhook handler |
| 2.2 | `webhook-handler.js` | Add `installation.deleted` webhook handler |
| 2.3 | `webhook-handler.js` | Modify `issue_comment.created` to fetch API key |
| 2.4 | `webhook-handler.js` | Add error handling for missing/invalid keys |

### Phase 3: GitHub Actions Update

| Task | File | Description |
|------|------|-------------|
| 3.1 | `worker.yml` | Remove static `ANTHROPIC_API_KEY` from secrets |
| 3.2 | `worker.yml` | Use `client_payload.anthropic_api_key` |
| 3.3 | `worker.yml` | Add validation step for API key presence |

### Phase 4: Alert System

| Task | File | Description |
|------|------|-------------|
| 4.1 | `lib/alert-service.js` | Create AlertService class |
| 4.2 | `lib/alert-service.js` | Implement email alerts (SendGrid) |
| 4.3 | `lib/alert-service.js` | Implement Slack webhook alerts |
| 4.4 | `lib/alert-service.js` | Implement GitHub Issue creation |

### Phase 5: Configuration

| Task | File | Description |
|------|------|-------------|
| 5.1 | `package.json` | Add `@supabase/supabase-js`, `@sendgrid/mail` |
| 5.2 | `.env.example` | Add new environment variables |

### Phase 6: Frontend (Separate Repo)

| Task | Description |
|------|-------------|
| 6.1 | Create Next.js project with Vercel |
| 6.2 | Implement GitHub OAuth authentication |
| 6.3 | Create setup page with API key form |
| 6.4 | Create dashboard for key management |
| 6.5 | Create notification settings page |

---

## Environment Variables

### Backend (.env)

```bash
# Existing
APP_ID=your_github_app_id
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
WEBHOOK_SECRET=your_webhook_secret
SMEE_URL=https://smee.io/your_channel
WORKER_REPO=username/claude-bot

# NEW - Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# NEW - Encryption
ENCRYPTION_KEY=your-64-character-hex-string-here

# NEW - Frontend URL
SETUP_URL=https://claude-bot-setup.vercel.app

# NEW - Alerts
SENDGRID_API_KEY=SG.xxxxx
```

### Frontend (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# Encryption (same key as backend)
ENCRYPTION_KEY=your-64-character-hex-string-here

# GitHub OAuth
GITHUB_APP_CLIENT_ID=Iv1.xxxxx
GITHUB_APP_CLIENT_SECRET=xxxxx

# NextAuth
NEXTAUTH_SECRET=random-secret-string
NEXTAUTH_URL=https://claude-bot-setup.vercel.app
```

---

## GitHub App Settings Update

Update your GitHub App settings at `https://github.com/settings/apps/YOUR_APP`:

| Setting | Value |
|---------|-------|
| Setup URL | `https://claude-bot-setup.vercel.app/setup` |
| Redirect on update | ✅ Checked |
| Request user authorization (OAuth) | ✅ Enabled |
| Callback URL | `https://claude-bot-setup.vercel.app/api/auth/github/callback` |

---

## Security Considerations

### Encryption
- AES-256-GCM with unique IV per encryption
- Authentication tag prevents tampering
- Master key stored in environment variables only
- Keys decrypted only when needed, never logged

### Access Control
- Users can only access their own installations
- Installation ownership verified via GitHub OAuth
- Webhook signatures verified on all requests

### Data Protection
- API keys never logged or exposed in responses
- Only key prefix stored for identification (e.g., `sk-ant-api...`)
- Supabase Row Level Security (RLS) policies

---

## Alert Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API KEY FAILURE DETECTED                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │  Increment failure_count in DB  │
                    └─────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │     failure_count >= 3 ?        │
                    └─────────────────────────────────┘
                           │                │
                          YES               NO
                           │                │
                           ▼                ▼
        ┌──────────────────────────┐    ┌──────────────┐
        │ Set key_status='invalid' │    │   Continue   │
        └──────────────────────────┘    │   silently   │
                           │            └──────────────┘
                           ▼
        ┌──────────────────────────┐
        │  Get notification_settings│
        └──────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
      ┌─────────────┐ ┌─────────┐ ┌─────────────┐
      │   Email     │ │ GitHub  │ │   Slack     │
      │ (if enabled)│ │  Issue  │ │(if enabled) │
      └─────────────┘ └─────────┘ └─────────────┘
              │            │            │
              └────────────┼────────────┘
                           ▼
              ┌─────────────────────────┐
              │  Log to alert_history   │
              └─────────────────────────┘
```

---

## API Endpoints (Frontend)

### `POST /api/auth/github`
Initiates GitHub OAuth flow for user authentication.

### `GET /api/auth/github/callback`
Handles OAuth callback, creates session.

### `POST /api/api-key/validate`
Validates an API key with Anthropic before saving.

```json
// Request
{ "apiKey": "sk-ant-api03-..." }

// Response (success)
{ "valid": true }

// Response (failure)
{ "valid": false, "error": "Invalid API key" }
```

### `POST /api/api-key`
Saves encrypted API key for an installation.

```json
// Request
{
  "installationId": "12345678",
  "apiKey": "sk-ant-api03-..."
}

// Response
{ "success": true }
```

### `GET /api/installations`
Lists user's GitHub App installations.

### `PUT /api/notifications`
Updates notification preferences.

```json
// Request
{
  "emailEnabled": true,
  "emailAddress": "user@example.com",
  "slackEnabled": true,
  "slackWebhookUrl": "https://hooks.slack.com/..."
}
```

---

## Testing Checklist

- [ ] Encryption/decryption works correctly
- [ ] Installation webhook stores user and installation
- [ ] API key validation with Anthropic works
- [ ] Encrypted key can be retrieved and decrypted
- [ ] Workflow receives API key in payload
- [ ] Missing API key shows helpful error message
- [ ] Invalid API key triggers alerts after 3 failures
- [ ] Email alerts sent correctly
- [ ] Slack alerts sent correctly
- [ ] GitHub Issues created correctly
- [ ] User can update their API key
- [ ] User can update notification settings

---

## Rollback Plan

If issues arise:

1. **Revert webhook-handler.js** to use static `ANTHROPIC_API_KEY` from secrets
2. **Revert worker.yml** to use `secrets.ANTHROPIC_API_KEY`
3. Keep Supabase data intact for future migration
4. Disable setup URL redirect in GitHub App settings

---

## Future Enhancements

1. **Key Rotation Reminders** - Notify users to rotate keys periodically
2. **Usage Analytics** - Track API usage per installation
3. **Team Support** - Multiple users per organization installation
4. **Key Sharing** - Share keys across installations (enterprise)
5. **Audit Logs** - Track all key access and modifications
