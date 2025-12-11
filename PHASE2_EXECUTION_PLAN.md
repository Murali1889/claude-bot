# Phase 2: Direct Claude Code CLI Execution

## Overview

Instead of using GitHub Actions and webhooks, we execute Claude Code CLI **directly inside the app** when user submits a problem.

**No @claude tags, No GitHub Actions, No workflows.**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      USER FLOW                               │
└─────────────────────────────────────────────────────────────┘

1. User logs in and installs GitHub App
   ↓
2. User navigates to Settings → Stores Claude Code CLI token
   ↓
3. User goes to Dashboard → Selects a repository
   ↓
4. User enters problem statement
   ↓
5. User clicks "Create Fix"
   ↓
6. Backend:
   - Fetches user's Claude token (encrypted)
   - Gets installation access token from GitHub
   - Clones repository to temporary directory
   - Runs: claude-code with token and problem statement
   - Captures code changes
   - Creates a new branch via GitHub API
   - Commits changes via GitHub API
   - Creates PR via GitHub API
   ↓
7. User sees PR link
   ↓
8. User reviews and merges PR on GitHub
```

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                         │
├──────────────────────────────────────────────────────────────┤
│  - Dashboard (repo selection)                                 │
│  - Problem Submission Form                                    │
│  - Settings (Claude token management)                         │
│  - PR Status Display                                          │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│                    API LAYER (Next.js API Routes)            │
├──────────────────────────────────────────────────────────────┤
│  POST /api/tokens/save       - Save Claude token             │
│  GET  /api/tokens/status     - Check if token exists         │
│  POST /api/fix/execute       - Execute fix for problem       │
│  GET  /api/fix/status/:id    - Check fix execution status    │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│                 EXECUTION SERVICE (Node.js)                   │
├──────────────────────────────────────────────────────────────┤
│  1. Clone Repository (to /tmp)                                │
│  2. Set up Claude Code CLI environment                        │
│  3. Execute: claude-code --token=XXX                          │
│  4. Capture changes (git diff)                                │
│  5. Create branch via GitHub API                              │
│  6. Push changes via GitHub API                               │
│  7. Create PR via GitHub API                                  │
│  8. Clean up temporary files                                  │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                          │
├──────────────────────────────────────────────────────────────┤
│  - users                                                      │
│  - installations                                              │
│  - api_keys (stores encrypted Claude tokens)                  │
│  - fix_jobs (tracks execution status)                         │
└──────────────────────────────────────────────────────────────┘
```

## Database Schema Updates

### Update api_keys table

```sql
-- Add field to differentiate token type
ALTER TABLE api_keys
ADD COLUMN IF NOT EXISTS token_type VARCHAR(50) DEFAULT 'claude_code_token';

-- token_type values:
-- 'claude_code_token' - Claude Code CLI OAuth token
-- 'anthropic_api_key' - Direct Anthropic API key (future)
```

### Create fix_jobs table

```sql
CREATE TABLE IF NOT EXISTS fix_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    installation_id BIGINT REFERENCES installations(installation_id),
    repository_id BIGINT NOT NULL,
    repository_name VARCHAR(255) NOT NULL,
    repository_full_name VARCHAR(500) NOT NULL,

    -- Problem details
    problem_statement TEXT NOT NULL,

    -- Execution status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Results
    branch_name VARCHAR(255),
    pr_number INTEGER,
    pr_url TEXT,

    -- Logs
    execution_log TEXT,
    error_message TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fix_jobs_user_id ON fix_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_fix_jobs_status ON fix_jobs(status);
CREATE INDEX IF NOT EXISTS idx_fix_jobs_created_at ON fix_jobs(created_at DESC);
```

## Implementation Steps

### Step 1: Token Management

#### 1.1 Update Setup Page

Add option to enter Claude Code CLI token instead of API key.

**File**: `frontend/app/setup/page.tsx`

```typescript
// Add token type selection
<select value={tokenType}>
  <option value="claude_code_token">Claude Code CLI Token</option>
  <option value="anthropic_api_key">Anthropic API Key</option>
</select>
```

#### 1.2 Token Save Endpoint

**File**: `frontend/app/api/tokens/save/route.ts`

```typescript
POST /api/tokens/save
Body: {
  installation_id: number,
  token: string,
  token_type: 'claude_code_token'
}

Security:
- Verify user is authenticated
- Verify user owns installation
- Encrypt token before storage
- Store in api_keys table
```

#### 1.3 Token Validation

Validate Claude Code token by making a test API call:

```bash
# Test if token works
curl -H "Authorization: Bearer $TOKEN" \
  https://api.anthropic.com/v1/messages \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":1024,"messages":[{"role":"user","content":"test"}]}'
```

### Step 2: Problem Submission UI

#### 2.1 Create Fix Page

**File**: `frontend/app/fix/page.tsx`

```typescript
Flow:
1. User selects repository from dropdown (from installations)
2. User enters problem statement (textarea)
3. User clicks "Create Fix"
4. Show loading state with progress
5. Show PR link when complete
```

#### 2.2 Repository Selection

```typescript
// Fetch repositories for user's installations
GET /api/installations/repositories

Response: {
  installations: [
    {
      id: 123,
      account_login: "username",
      repositories: [
        { id: 456, name: "repo-name", full_name: "username/repo-name" }
      ]
    }
  ]
}
```

### Step 3: Execution Service

#### 3.1 Execute Fix Endpoint

**File**: `frontend/app/api/fix/execute/route.ts`

```typescript
POST /api/fix/execute
Body: {
  installation_id: number,
  repository_id: number,
  repository_full_name: string,
  problem_statement: string
}

Flow:
1. Verify user is authenticated
2. Verify user owns installation
3. Get Claude token from database
4. Create fix_job in database (status: 'pending')
5. Queue background job to execute fix
6. Return job_id immediately
```

#### 3.2 Background Execution

**File**: `frontend/lib/executor-service.ts`

```typescript
async function executeFix(jobId: string) {
  // Update status to 'running'
  await updateJobStatus(jobId, 'running');

  try {
    // 1. Get job details from database
    const job = await getJob(jobId);

    // 2. Get Claude token (decrypted)
    const token = await getClaudeToken(job.installation_id);

    // 3. Get installation access token from GitHub
    const githubToken = await getInstallationToken(job.installation_id);

    // 4. Clone repository to /tmp
    const repoPath = await cloneRepository(
      job.repository_full_name,
      githubToken
    );

    // 5. Execute Claude Code CLI
    const changes = await runClaudeCLI(
      repoPath,
      token,
      job.problem_statement
    );

    // 6. Create branch via GitHub API
    const branchName = `claude-fix-${Date.now()}`;
    await createBranch(
      job.repository_full_name,
      branchName,
      githubToken
    );

    // 7. Commit changes via GitHub API
    await commitChanges(
      job.repository_full_name,
      branchName,
      changes,
      githubToken
    );

    // 8. Create PR via GitHub API
    const pr = await createPR(
      job.repository_full_name,
      branchName,
      job.problem_statement,
      githubToken
    );

    // 9. Update job status
    await updateJobStatus(jobId, 'completed', {
      branch_name: branchName,
      pr_number: pr.number,
      pr_url: pr.html_url
    });

    // 10. Clean up
    await cleanupRepo(repoPath);

  } catch (error) {
    await updateJobStatus(jobId, 'failed', {
      error_message: error.message
    });
  }
}
```

### Step 4: Claude Code CLI Execution

#### 4.1 Install Claude Code CLI

```bash
# In your deployment environment
npm install -g @anthropic-ai/claude-code
```

#### 4.2 Execute CLI

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runClaudeCLI(
  repoPath: string,
  token: string,
  problemStatement: string
) {
  // Set environment variable for token
  const env = {
    ...process.env,
    ANTHROPIC_API_KEY: token,
  };

  // Run Claude CLI
  const { stdout, stderr } = await execAsync(
    `cd ${repoPath} && claude "${problemStatement}"`,
    { env, timeout: 300000 } // 5 minute timeout
  );

  // Get git diff to see what changed
  const { stdout: diff } = await execAsync(
    `cd ${repoPath} && git diff`,
    { env }
  );

  return {
    output: stdout,
    errors: stderr,
    diff: diff,
  };
}
```

### Step 5: GitHub API Integration

#### 5.1 Create Branch

```typescript
async function createBranch(
  repoFullName: string,
  branchName: string,
  githubToken: string
) {
  const [owner, repo] = repoFullName.split('/');

  // Get default branch SHA
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: 'heads/main', // or 'master'
  });

  // Create new branch
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: ref.object.sha,
  });
}
```

#### 5.2 Commit Changes

```typescript
async function commitChanges(
  repoFullName: string,
  branchName: string,
  changes: FileChange[],
  githubToken: string
) {
  const [owner, repo] = repoFullName.split('/');

  for (const file of changes) {
    // Create or update file
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: file.path,
      message: `Fix: ${file.description}`,
      content: Buffer.from(file.content).toString('base64'),
      branch: branchName,
    });
  }
}
```

#### 5.3 Create Pull Request

```typescript
async function createPR(
  repoFullName: string,
  branchName: string,
  problemStatement: string,
  githubToken: string
) {
  const [owner, repo] = repoFullName.split('/');

  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title: `Fix: ${problemStatement.substring(0, 60)}...`,
    body: `## Problem Statement\n\n${problemStatement}\n\n## Solution\n\nThis PR was generated by Claude Code CLI.\n\n---\n🤖 Generated by Claude Bot`,
    head: branchName,
    base: 'main', // or 'master'
  });

  return pr;
}
```

## Security Considerations

### 1. Token Security
- ✅ Encrypt tokens using AES-256-GCM
- ✅ Store encryption key in environment variables only
- ✅ Never log or expose tokens
- ✅ Decrypt only when needed for execution

### 2. Repository Access
- ✅ Verify user owns installation before accessing repo
- ✅ Use installation access tokens (scoped, short-lived)
- ✅ Only access repositories user has granted access to

### 3. Execution Isolation
- ✅ Run in temporary directories (`/tmp/claude-fix-${jobId}`)
- ✅ Clean up after execution
- ✅ Timeout after 5 minutes to prevent hanging
- ✅ Resource limits (CPU, memory)

### 4. Input Validation
- ✅ Sanitize problem statements
- ✅ Validate repository names
- ✅ Rate limit requests per user
- ✅ Maximum problem statement length

## Deployment Considerations

### Environment Setup

```bash
# Install Claude Code CLI on server
npm install -g @anthropic-ai/claude-code

# Install git
apt-get install git

# Set up Node.js environment
node --version  # Should be v18+
```

### Vercel Limitations

⚠️ **Vercel has limitations for this approach:**

1. **No persistent file system** - Can't clone repos to /tmp persistently
2. **10 second timeout** - Serverless functions timeout quickly
3. **Limited compute** - Can't run long-running processes

### Alternative: Use a Background Worker

**Recommended Architecture:**

```
Vercel Frontend
    ↓
POST /api/fix/execute
    ↓
Queue job in database
    ↓
Return job_id immediately
    ↓
[Separate Background Worker Service]
    ↓
Polls database for pending jobs
    ↓
Executes Claude Code CLI
    ↓
Creates PR
    ↓
Updates job status
```

**Worker Options:**
1. **Railway** - Simple, supports long-running processes
2. **Render** - Background workers
3. **AWS Lambda** - With 15 minute timeout
4. **DigitalOcean App Platform** - Background workers
5. **Self-hosted VPS** - Full control

## User Flow Wireframes

### 1. Settings Page (Token Input)

```
┌─────────────────────────────────────────┐
│  Settings                                │
├─────────────────────────────────────────┤
│                                          │
│  Claude Code CLI Token                   │
│  ┌──────────────────────────────────┐   │
│  │ Enter your Claude Code token...   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  [Validate Token]  [Save Token]          │
│                                          │
│  ℹ️  Get token: claude setup-token      │
│                                          │
└─────────────────────────────────────────┘
```

### 2. Fix Page (Problem Submission)

```
┌─────────────────────────────────────────┐
│  Create Fix                              │
├─────────────────────────────────────────┤
│                                          │
│  Select Repository                       │
│  ┌──────────────────────────────────┐   │
│  │ username/my-repo            ▼    │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Problem Statement                       │
│  ┌──────────────────────────────────┐   │
│  │ Describe the bug or feature...   │   │
│  │                                  │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                          │
│  [Create Fix]                            │
│                                          │
└─────────────────────────────────────────┘
```

### 3. Execution Progress

```
┌─────────────────────────────────────────┐
│  Fixing: Add error handling              │
├─────────────────────────────────────────┤
│                                          │
│  ✓ Analyzing repository                  │
│  ✓ Running Claude Code CLI               │
│  ⏳ Creating pull request...             │
│  ⏺ Cleaning up                           │
│                                          │
│  [View Logs]                             │
│                                          │
└─────────────────────────────────────────┘
```

### 4. Success Page

```
┌─────────────────────────────────────────┐
│  ✅ Fix Created Successfully!           │
├─────────────────────────────────────────┤
│                                          │
│  Pull Request #42                        │
│  username/my-repo                        │
│                                          │
│  "Add error handling to API endpoints"   │
│                                          │
│  [View PR on GitHub] [Create Another]    │
│                                          │
└─────────────────────────────────────────┘
```

## Testing Plan

### 1. Token Storage
- [ ] Save Claude Code CLI token
- [ ] Verify encryption in database
- [ ] Decrypt and verify token works
- [ ] Update token
- [ ] Delete token

### 2. Problem Submission
- [ ] Select repository from list
- [ ] Enter problem statement
- [ ] Submit for execution
- [ ] Receive job_id

### 3. Execution
- [ ] Clone repository to /tmp
- [ ] Run Claude Code CLI
- [ ] Capture changes
- [ ] Create branch via GitHub API
- [ ] Commit changes
- [ ] Create PR
- [ ] Clean up temp files

### 4. Error Handling
- [ ] Invalid token
- [ ] Repository not found
- [ ] Permission denied
- [ ] Claude CLI timeout
- [ ] GitHub API errors
- [ ] Network failures

## Cost Estimation

### Anthropic API Costs
- Claude Code CLI uses Claude API
- Pricing: https://www.anthropic.com/pricing
- Estimate: $0.10 - $1.00 per fix (depending on complexity)

### Infrastructure Costs
- Vercel: Free tier (frontend only)
- Background Worker: $5-20/month (Railway, Render)
- Supabase: Free tier (up to 500MB DB)

## Next Steps

1. ✅ Update database schema (add fix_jobs table)
2. ✅ Create token save endpoint
3. ✅ Create token settings page
4. ✅ Create fix submission page
5. ✅ Create executor service
6. ✅ Set up background worker
7. ✅ Test end-to-end flow
8. ✅ Deploy to production

Let's start implementing! 🚀
