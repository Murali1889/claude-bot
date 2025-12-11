# How Claude Bot Creates Pull Requests

## Complete Flow Explained

### The Big Picture

```
User → Submits Problem → App Runs Claude CLI → Creates PR
                ↓                    ↓               ↓
           Database          Temp Directory    GitHub API
```

## Step-by-Step Flow

### 1. User Submits Problem

**Page**: `/fix`

```
User visits: http://localhost:3001/fix
    ↓
Selects repository: "username/my-repo"
    ↓
Enters problem: "Fix null pointer exception in UserService"
    ↓
Clicks: "Create Fix"
```

**What happens**:
- Form sends POST request to `/api/fix/execute`
- Request body contains:
  ```json
  {
    "installation_id": 12345,
    "repository_id": 67890,
    "repository_full_name": "username/my-repo",
    "problem_statement": "Fix null pointer exception in UserService"
  }
  ```

### 2. API Creates Job

**File**: `app/api/fix/execute/route.ts`

```typescript
// 1. Verify user is logged in
const user = await getSessionUser();

// 2. Verify user owns the installation
const installation = await supabase
  .from("installations")
  .select("*")
  .eq("installation_id", installation_id)
  .eq("user_id", user.id)
  .single();

// 3. Verify Claude token exists
const apiKey = await supabase
  .from("api_keys")
  .select("*")
  .eq("installation_id", installation_id)
  .single();

// 4. Create job in database
const job = await supabase
  .from("fix_jobs")
  .insert({
    user_id: user.id,
    installation_id: installation_id,
    repository_id: repository_id,
    repository_full_name: "username/my-repo",
    problem_statement: "Fix null pointer exception...",
    status: "pending"
  })
  .single();

// 5. Start execution (async, don't wait)
executeFix(job.id); // Fire and forget

// 6. Return job ID immediately
return { job_id: job.id, status: "pending" };
```

**Result**: Job created in database, execution started in background.

### 3. Executor Service Runs

**File**: `lib/executor-service.ts`

This is where the magic happens! Here's the detailed breakdown:

#### Step 3.1: Get Claude Token

```typescript
// Update job status
await supabase
  .from("fix_jobs")
  .update({ status: "running", started_at: NOW() })
  .eq("id", jobId);

// Get encrypted token from database
const apiKey = await supabase
  .from("api_keys")
  .select("*")
  .eq("installation_id", job.installation_id)
  .single();

// Decrypt token
const token = decrypt(
  apiKey.encrypted_key,
  apiKey.key_iv,
  apiKey.key_auth_tag,
  process.env.ENCRYPTION_KEY
);
```

**Result**: We now have the user's Claude Code token in plain text (in memory only).

#### Step 3.2: Clone Repository

```typescript
// Create temp directory
const tempDir = `/tmp/claude-fix-${jobId}`;
await fs.mkdir(tempDir);

// Clone repo to temp directory
await exec(
  `git clone --depth 1 https://github.com/username/my-repo.git ${tempDir}`
);
```

**Result**: Repository is now on the server at `/tmp/claude-fix-abc123/`

```
/tmp/claude-fix-abc123/
├── src/
│   ├── UserService.java
│   └── ...
├── package.json
└── README.md
```

#### Step 3.3: Run Claude Code CLI

```typescript
// Run Claude CLI with the problem statement
const { stdout } = await exec(
  `cd ${tempDir} && echo "Fix null pointer exception in UserService" | npx @anthropic-ai/claude-code --non-interactive`,
  {
    env: {
      ANTHROPIC_API_KEY: token, // Use decrypted token
    },
    timeout: 300000, // 5 minutes
  }
);
```

**What Claude does**:
1. Reads the problem statement
2. Analyzes the codebase
3. Identifies the issue (null pointer in UserService.java)
4. Generates a fix
5. **Modifies files directly** in `/tmp/claude-fix-abc123/`

**Result**: Files are changed in the temp directory.

```
/tmp/claude-fix-abc123/
├── src/
│   ├── UserService.java  ← MODIFIED!
│   └── ...
```

#### Step 3.4: Detect Changed Files

```typescript
// Git shows what changed
const { stdout } = await exec(`cd ${tempDir} && git status --porcelain`);

// Output looks like:
// M src/UserService.java
// M src/UserController.java

// Parse the changes
const changedFiles = [];
for (const line of stdout.split("\n")) {
  const filePath = line.substring(3); // Remove "M  " prefix
  const content = await fs.readFile(
    path.join(tempDir, filePath),
    "utf-8"
  );

  changedFiles.push({
    path: filePath,
    content: content, // Full file content
  });
}
```

**Result**: We have an array of changed files with their new content.

```javascript
changedFiles = [
  {
    path: "src/UserService.java",
    content: "public class UserService {\n  // Fixed code here...\n}",
  },
  {
    path: "src/UserController.java",
    content: "public class UserController {\n  // Fixed code here...\n}",
  },
];
```

### 4. Create Branch via GitHub API

**File**: `lib/github-service.ts`

```typescript
// Get default branch (usually 'main' or 'master')
const { data: repo } = await octokit.repos.get({
  owner: "username",
  repo: "my-repo",
});
const defaultBranch = repo.default_branch; // 'main'

// Get the SHA (commit hash) of main branch
const { data: ref } = await octokit.git.getRef({
  owner: "username",
  repo: "my-repo",
  ref: "heads/main",
});
const mainSha = ref.object.sha; // 'abc123...'

// Create new branch pointing to same commit
const branchName = `claude-fix-${Date.now()}`;
await octokit.git.createRef({
  owner: "username",
  repo: "my-repo",
  ref: `refs/heads/${branchName}`,
  sha: mainSha, // Start from main
});
```

**Result**: New branch `claude-fix-1234567890` created on GitHub.

```
main        →  [abc123]
                  ↓
claude-fix-... → [abc123] (same commit, new branch)
```

### 5. Commit Changes via GitHub API

**File**: `lib/github-service.ts`

For each changed file:

```typescript
// For src/UserService.java:
await octokit.repos.createOrUpdateFileContents({
  owner: "username",
  repo: "my-repo",
  path: "src/UserService.java",
  message: "Fix: null pointer exception in UserService",
  content: Buffer.from(fileContent).toString("base64"), // Base64 encode
  branch: branchName, // Commit to our new branch
});

// For src/UserController.java:
await octokit.repos.createOrUpdateFileContents({
  owner: "username",
  repo: "my-repo",
  path: "src/UserController.java",
  message: "Fix: null pointer exception in UserService",
  content: Buffer.from(fileContent).toString("base64"),
  branch: branchName,
});
```

**Result**: New commits on the branch with our changes.

```
main        →  [abc123]
                  ↓
claude-fix-... → [abc123] → [def456] → [ghi789]
                             Fix 1      Fix 2
```

### 6. Create Pull Request

**File**: `lib/github-service.ts`

```typescript
const { data: pr } = await octokit.pulls.create({
  owner: "username",
  repo: "my-repo",
  title: "Fix: null pointer exception in UserService",
  body: `## Problem Statement

Fix null pointer exception in UserService

## Solution

This PR was automatically generated by Claude Code CLI.

### Changes

- \`src/UserService.java\`
- \`src/UserController.java\`

---

🤖 Generated by Claude Bot`,
  head: branchName, // Our branch
  base: "main", // Target branch
});
```

**Result**: Pull request created!

```
PR #42: "Fix: null pointer exception in UserService"
  claude-fix-1234567890 → main

  Files changed:
  - src/UserService.java
  - src/UserController.java
```

### 7. Update Job Status

```typescript
// Mark job as completed
await supabase
  .from("fix_jobs")
  .update({
    status: "completed",
    completed_at: new Date(),
    branch_name: branchName,
    pr_number: pr.number,
    pr_url: pr.html_url,
  })
  .eq("id", jobId);
```

### 8. Clean Up

```typescript
// Delete temp directory
await fs.rm(tempDir, { recursive: true, force: true });
```

**Result**: `/tmp/claude-fix-abc123/` is deleted, freeing up disk space.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
├─────────────────────────────────────────────────────────────────┤
│  1. Visit /fix                                                   │
│  2. Select repo: "username/my-repo"                              │
│  3. Enter problem: "Fix null pointer exception"                  │
│  4. Submit                                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓ POST /api/fix/execute
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS API (Vercel)                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Verify user authentication                                   │
│  2. Verify ownership of installation                             │
│  3. Check Claude token exists                                    │
│  4. Create fix_job in Supabase                                   │
│  5. Call executeFix(jobId) async                                │
│  6. Return job_id immediately                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓ executeFix(jobId)
┌─────────────────────────────────────────────────────────────────┐
│                 EXECUTOR SERVICE (Background)                    │
├─────────────────────────────────────────────────────────────────┤
│  1. Get Claude token from Supabase (encrypted)                   │
│  2. Decrypt token                                                │
│  3. git clone repo to /tmp/                                      │
│  4. cd /tmp/repo && claude "problem statement"                   │
│  5. git status --porcelain (find changed files)                  │
│  6. Read changed files' content                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                     GITHUB API                                   │
├─────────────────────────────────────────────────────────────────┤
│  1. Create branch: "claude-fix-1234567890"                       │
│  2. For each changed file:                                       │
│     - Base64 encode content                                      │
│     - POST /repos/{owner}/{repo}/contents/{path}                 │
│  3. Create PR:                                                   │
│     - POST /repos/{owner}/{repo}/pulls                           │
│     - head: "claude-fix-1234567890"                              │
│     - base: "main"                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓ PR created!
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                             │
├─────────────────────────────────────────────────────────────────┤
│  Update fix_jobs:                                                │
│    status: "completed"                                           │
│    pr_number: 42                                                 │
│    pr_url: "https://github.com/username/my-repo/pull/42"         │
└─────────────────────────────────────────────────────────────────┘
```

## Why No GitHub Actions?

Traditional approach:
```
User mentions @claude in issue
    ↓
Webhook to server
    ↓
Server creates .github/workflows/fix.yml
    ↓
Commits workflow file
    ↓
GitHub Actions runs workflow
    ↓
Workflow runs Claude CLI
    ↓
Workflow creates PR
```

**Problems**:
- Requires writing workflow files
- Slower (GitHub Actions startup time)
- Less control over execution
- Need to manage secrets

Our approach:
```
User submits via UI
    ↓
App runs Claude CLI directly
    ↓
App creates PR via API
```

**Benefits**:
- ✅ Faster execution
- ✅ Complete control
- ✅ No workflow files needed
- ✅ No GitHub Actions required
- ✅ Better error handling
- ✅ Direct feedback to user

## Security Features

### 1. Token Storage
```
User's Claude token
    ↓
Encrypted with AES-256-GCM
    ↓
Stored in Supabase
    ↓
Only decrypted when needed (in memory)
    ↓
Never logged or exposed
```

### 2. Ownership Verification
```
User submits fix request
    ↓
Check: user owns installation?
    ↓
Check: installation has access to repo?
    ↓
Check: Claude token exists for installation?
    ↓
Only then: execute
```

### 3. Isolation
```
Each execution:
    ↓
Unique temp directory: /tmp/claude-fix-{unique-id}
    ↓
Deleted after execution
    ↓
No cross-contamination between jobs
```

## Important Limitations

### Vercel Constraints

⚠️ **This won't work on Vercel** because:

1. **10 second timeout** - Serverless functions time out after 10 seconds
2. **No file system** - Can't git clone to `/tmp/` persistently
3. **No background processes** - Can't run long Claude CLI executions

### Solution: Background Worker

Deploy the executor service separately on:
- **Railway** (recommended)
- **Render**
- **DigitalOcean App Platform**
- **AWS Lambda** (with 15 min timeout)
- **Self-hosted VPS**

## Next Steps

1. **Test locally** - Works on your machine!
2. **Deploy frontend to Vercel** - UI and API routes
3. **Deploy executor to Railway** - Background worker
4. **Connect them** - Share Supabase database

Let me know if you want help with deployment! 🚀
