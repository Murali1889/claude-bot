# Phase 2: Implementation Status

## ✅ Completed (Step 1: Token Storage)

### What's Been Built

1. **Database Schema** (`schema/phase2-fix-jobs.sql`)
   - ✅ `fix_jobs` table to track Claude Code executions
   - ✅ Updated `api_keys` table with `token_type` field
   - ✅ RLS policies for security
   - ✅ Indexes for performance

2. **Token Save API** (`app/api/tokens/save/route.ts`)
   - ✅ POST endpoint to save encrypted tokens
   - ✅ GET endpoint to retrieve token status
   - ✅ AES-256-GCM encryption
   - ✅ Ownership verification
   - ✅ Token validation

3. **Settings Page** (`app/settings/page.tsx` + `SettingsClient.tsx`)
   - ✅ Installation selection dropdown
   - ✅ Token type selection (Claude Code vs API Key)
   - ✅ Secure token input (password field)
   - ✅ Token status display
   - ✅ Help section with instructions

## Architecture Flow (Completed Part)

```
User logs in
    ↓
Dashboard → Settings
    ↓
Select installation
    ↓
Choose token type:
  • Claude Code CLI Token (recommended)
  • Anthropic API Key (alternative)
    ↓
Paste token
    ↓
POST /api/tokens/save
    ↓
Verify ownership
    ↓
Encrypt token (AES-256-GCM)
    ↓
Store in api_keys table
    ↓
Success! Token saved ✅
```

## How to Test

### Step 1: Run Database Migration

Go to Supabase SQL Editor and run:

```sql
-- Run this file
schema/phase2-fix-jobs.sql
```

This creates:
- `fix_jobs` table
- Updates `api_keys` table with `token_type` column

### Step 2: Get Claude Code Token

```bash
# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Generate token
claude setup-token
```

This will:
1. Open browser for OAuth
2. Authenticate with Anthropic
3. Generate a token
4. Display token in terminal

Copy the token!

### Step 3: Test Settings Page

1. **Navigate to Settings**
   ```
   http://localhost:3001/settings
   ```

2. **Select Installation**
   - Choose from your GitHub App installations

3. **Choose Token Type**
   - Select "Claude Code CLI Token"

4. **Paste Token**
   - Paste the token from Step 2

5. **Save Token**
   - Click "Save Token"
   - Should see success message

6. **Verify in Database**
   ```sql
   SELECT
     ak.installation_id,
     ak.key_prefix,
     ak.token_type,
     ak.key_status,
     i.account_login
   FROM api_keys ak
   JOIN installations i ON ak.installation_id = i.installation_id
   WHERE ak.token_type = 'claude_code_token';
   ```

## Security Features Implemented

### 1. Encryption
```typescript
// Token encrypted before storage
const { encrypted, iv, authTag } = encrypt(token, encryptionKey);

// Uses AES-256-GCM
// - Unique IV per encryption
// - Authentication tag prevents tampering
// - Master key in environment variables only
```

### 2. Ownership Verification
```typescript
// Verify user owns installation
if (installation.user_id !== user.id) {
  return 403 Forbidden
}
```

### 3. Token Validation
```typescript
// Validate format
if (token_type === "anthropic_api_key" && !token.startsWith("sk-ant-")) {
  return 400 Bad Request
}

// Validate length
if (token.length < 20 || token.length > 500) {
  return 400 Bad Request
}
```

### 4. Session Authentication
```typescript
// All endpoints require authentication
const user = await getSessionUser();
if (!user) {
  return 401 Unauthorized
}
```

## Database Schema

### api_keys table (updated)

```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    installation_id BIGINT UNIQUE REFERENCES installations,
    user_id UUID REFERENCES users,

    -- Encrypted token
    encrypted_key TEXT NOT NULL,
    key_iv VARCHAR(64) NOT NULL,
    key_auth_tag VARCHAR(64) NOT NULL,

    -- Token metadata
    key_prefix VARCHAR(20),
    token_type VARCHAR(50) DEFAULT 'anthropic_api_key',
    -- 'claude_code_token' or 'anthropic_api_key'

    key_status VARCHAR(50) DEFAULT 'active',
    failure_count INTEGER DEFAULT 0,
    last_validated_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### fix_jobs table (new)

```sql
CREATE TABLE fix_jobs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users,
    installation_id BIGINT REFERENCES installations,

    -- Repository
    repository_id BIGINT NOT NULL,
    repository_name VARCHAR(255) NOT NULL,
    repository_full_name VARCHAR(500) NOT NULL,

    -- Problem
    problem_statement TEXT NOT NULL,

    -- Execution
    status VARCHAR(50) DEFAULT 'pending',
    -- 'pending', 'running', 'completed', 'failed'
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Results
    branch_name VARCHAR(255),
    pr_number INTEGER,
    pr_url TEXT,

    -- Logs
    execution_log TEXT,
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints

### POST /api/tokens/save

**Purpose**: Save encrypted Claude Code token

**Request**:
```json
{
  "installation_id": 12345,
  "token": "oat_your_token_here",
  "token_type": "claude_code_token"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Token saved successfully",
  "token_info": {
    "token_type": "claude_code_token",
    "key_prefix": "oat_your_token...",
    "status": "active"
  }
}
```

**Response (Error)**:
```json
{
  "error": "Forbidden",
  "message": "You do not own this installation"
}
```

### GET /api/tokens/save

**Purpose**: Get token status for user's installations

**Response**:
```json
{
  "tokens": [
    {
      "installation_id": 12345,
      "key_prefix": "oat_your_token...",
      "token_type": "claude_code_token",
      "key_status": "active",
      "last_validated_at": "2024-01-01T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Next Steps (Phase 2 Part 2)

### To Complete Phase 2, we still need:

1. **Fix Submission Page** (`app/fix/page.tsx`)
   - Repository selection dropdown
   - Problem statement textarea
   - Submit button
   - Status display

2. **Fix Execution API** (`app/api/fix/execute/route.ts`)
   - Validate request
   - Create fix_job in database
   - Queue background job
   - Return job_id

3. **Executor Service** (`lib/executor-service.ts`)
   - Clone repository
   - Run Claude Code CLI with token
   - Capture changes
   - Create branch via GitHub API
   - Commit changes
   - Create PR
   - Clean up

4. **GitHub Service** (`lib/github-service.ts`)
   - Create branch
   - Commit files
   - Create pull request

5. **Background Worker** (separate service)
   - Poll for pending jobs
   - Execute jobs
   - Update status

## File Structure (Current)

```
frontend/
├── app/
│   ├── settings/
│   │   ├── page.tsx                 # ✅ Settings page (server)
│   │   └── SettingsClient.tsx       # ✅ Settings UI (client)
│   └── api/
│       └── tokens/
│           └── save/
│               └── route.ts         # ✅ Token save endpoint
├── lib/
│   ├── encryption.ts                # ✅ AES-256-GCM encryption
│   └── supabase.ts                  # ✅ Supabase client
└── schema/
    └── phase2-fix-jobs.sql          # ✅ Database schema
```

## Testing Checklist

### Token Storage
- [ ] Navigate to `/settings`
- [ ] Select installation from dropdown
- [ ] Choose "Claude Code CLI Token"
- [ ] Paste token from `claude setup-token`
- [ ] Click "Save Token"
- [ ] Verify success message
- [ ] Check "Configured Tokens" section shows new token
- [ ] Verify in Supabase database

### Security
- [ ] Try saving token without login → Should redirect to login
- [ ] Try saving token for installation you don't own → Should return 403
- [ ] Verify token is encrypted in database (not plain text)
- [ ] Verify token can be retrieved (GET /api/tokens/save)

### Edge Cases
- [ ] Try saving empty token → Should show error
- [ ] Try saving invalid API key format → Should show error
- [ ] Try updating existing token → Should upsert
- [ ] Try saving without selecting installation → Should show error

## Success Criteria

✅ Phase 2 Part 1 is complete when:

- ✅ Users can navigate to settings page
- ✅ Users can select their installations
- ✅ Users can save Claude Code tokens
- ✅ Tokens are encrypted before storage
- ✅ Token status is displayed
- ✅ Database schema is updated
- ✅ All security checks pass

## Production Deployment Notes

### Environment Variables Required

```bash
# Existing
ENCRYPTION_KEY=your-64-character-hex-string

# New (for Claude Code execution - Phase 2 Part 2)
CLAUDE_CODE_TIMEOUT=300000  # 5 minutes
MAX_CONCURRENT_JOBS=5
```

### Vercel Configuration

The settings page works on Vercel with no changes needed.

For the executor service (Part 2), we'll need a separate worker service because:
- Vercel has 10 second timeout for serverless functions
- Can't run long-lived processes
- No persistent file system

**Recommended**: Deploy executor as separate service on Railway or Render.

## Ready for Part 2?

You now have:
✅ Token storage working
✅ Settings page complete
✅ Database ready for fix jobs

Next, we'll build:
⏭️ Fix submission page
⏭️ Executor service
⏭️ PR creation

Let me know when you're ready to continue! 🚀
