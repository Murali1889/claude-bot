# GitHub App & Worker Repository Setup Guide

## Overview

This setup allows your app to trigger Claude Code CLI fixes without adding workflow files to user repositories.

**Architecture:**
```
User submits problem → Your app triggers worker workflow → GitHub Actions runs Claude CLI → Creates PR to user's repo
```

## Part 1: Create Worker Repository

### Step 1: Create Repository

1. Go to: https://github.com/new
2. Create a new repository:
   - **Name**: `claude-bot-worker` (or any name you prefer)
   - **Visibility**: Private (recommended) or Public
   - **Initialize**: Yes, with README

### Step 2: Add Workflow File

1. In your new repository, create directory: `.github/workflows/`
2. Create file: `.github/workflows/fix-code.yml`
3. Copy content from: `worker-workflow.yml` (in this project)
4. Commit the file

### Step 3: Add Repository Secrets

Go to repository Settings → Secrets and variables → Actions → New repository secret

Add these secrets:

| Secret Name | Value | Where to Get |
|------------|-------|--------------|
| `GITHUB_APP_ID` | Your GitHub App ID | GitHub App settings |
| `GITHUB_APP_PRIVATE_KEY` | Your GitHub App private key | GitHub App settings → Generate private key |

**Finding these values:**
- Go to: https://github.com/settings/apps/YOUR_APP_NAME
- **App ID**: Listed at the top
- **Private Key**: Click "Generate a private key" (downloads a .pem file)
  - Open the .pem file
  - Copy the entire contents including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`

## Part 2: Configure Your GitHub App

### Required Permissions

Go to: https://github.com/settings/apps/YOUR_APP_NAME/permissions

#### Repository Permissions

Set these permissions:

| Permission | Access | Why |
|-----------|---------|-----|
| Contents | Read & Write | Clone repos, create branches, commit changes |
| Pull requests | Read & Write | Create PRs |
| Workflows | Read & Write | Trigger workflows |
| Metadata | Read-only | Access repo info |

#### Account Permissions

| Permission | Access | Why |
|-----------|---------|-----|
| Members | Read-only | Identify users |

#### Where Can This App Be Installed?

- ✅ **Any account** (recommended for public use)
- OR: Only on this account (for testing)

### Subscribe to Events

**NOT NEEDED** for this approach! The app triggers workflows programmatically.

But if you want installation tracking:
- ✅ Installation
- ✅ Installation repositories

### Save Changes

Click **"Save changes"** at the bottom of the page.

## Part 3: Update Environment Variables

### Backend (.env or Vercel)

Add these new variables:

```bash
# Worker Repository Details
WORKER_REPO_OWNER=your-github-username
WORKER_REPO_NAME=claude-bot-worker

# These should already exist
APP_ID=your_app_id
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=...
ENCRYPTION_KEY=...
```

**On Vercel:**
1. Go to your project settings
2. Environment Variables
3. Add `WORKER_REPO_OWNER` and `WORKER_REPO_NAME`

### Worker Workflow (Already Done)

The workflow file uses:
- `secrets.GITHUB_APP_ID` ✅
- `secrets.GITHUB_APP_PRIVATE_KEY` ✅

## Part 4: Test the Setup

### Test 1: Trigger Workflow Manually

1. Go to your worker repository
2. Click "Actions" tab
3. Click "Claude Fix Code" workflow
4. Click "Run workflow"
5. Fill in inputs:
   - **target_repo**: `username/test-repo`
   - **problem_statement**: `Add console.log to main function`
   - **installation_id**: Your installation ID
   - **job_id**: `test-123`
   - **api_key**: Your Anthropic API key
6. Click "Run workflow"
7. Watch it run!

### Test 2: Via Your App

1. Make sure database migration is run: `schema/phase2-fix-jobs.sql`
2. Configure Claude token in Settings
3. Go to `/fix` page
4. Select repository
5. Enter problem: `Add a console.log to the main function`
6. Submit
7. Watch the progress!

## Part 5: How It Works

### The Flow

```
1. User visits /fix page
   └─ Selects repo: username/my-repo
   └─ Enters problem: "Fix the button color"
   └─ Clicks "Create Fix"

2. Your Next.js app:
   └─ POST /api/fix/execute
   └─ Creates job in database (status: pending)
   └─ Calls executeFix(jobId)

3. executeFix() function:
   └─ Gets Claude token from database (decrypted)
   └─ Triggers workflow in YOUR worker repo via GitHub API:
      POST /repos/your-username/claude-bot-worker/actions/workflows/fix-code.yml/dispatches
      {
        "ref": "main",
        "inputs": {
          "target_repo": "username/my-repo",
          "problem_statement": "Fix the button color",
          "installation_id": "12345",
          "job_id": "abc-123",
          "api_key": "sk-ant-..."
        }
      }

4. GitHub Actions (in YOUR worker repo):
   └─ Workflow starts running
   └─ Gets installation token for user's repo
   └─ Clones user's repo: git clone https://github.com/username/my-repo
   └─ Installs Claude CLI: npm install -g @anthropic-ai/claude-code
   └─ Runs: claude --prompt "Fix the button color"
   └─ Claude makes changes to files
   └─ Creates new branch: claude-fix-1234567890
   └─ Commits changes
   └─ Pushes to user's repo
   └─ Creates PR in user's repo
   └─ Sends webhook to your app: POST /api/fix/webhook

5. Your app receives webhook:
   └─ Updates job in database:
      - status: completed
      - pr_url: https://github.com/username/my-repo/pull/42
      - pr_number: 42

6. User's browser polls /api/fix/status/{jobId}
   └─ Sees status changed to "completed"
   └─ Shows PR link
   └─ User clicks "View Pull Request"
   └─ 🎉 Done!
```

### User's Repository

**STAYS COMPLETELY CLEAN!**
- ❌ No workflow files
- ❌ No config files
- ❌ No changes except the PR with fixes

## Part 6: GitHub App Installation Flow

### For New Users

1. User visits your app: `https://claude-bot.vercel.app`
2. Clicks "Sign in with GitHub"
3. OAuth flow completes
4. User clicks "Install GitHub App"
5. GitHub redirects to: `https://github.com/apps/YOUR_APP/installations/new`
6. User selects repositories
7. Clicks "Install"
8. GitHub redirects to: `https://claude-bot.vercel.app/setup?installation_id=123...`
9. Your app captures installation via `/api/installations/capture`
10. User configures Claude token in Settings
11. User can now create fixes!

## Part 7: Troubleshooting

### Issue: "Workflow not found"

**Problem**: Worker repository workflow doesn't exist

**Solution**:
1. Check file exists: `.github/workflows/fix-code.yml` in worker repo
2. Check file name matches in trigger code: `workflow_id: "fix-code.yml"`
3. Push to main branch (workflows must be on default branch)

### Issue: "Installation token failed"

**Problem**: GitHub App secrets not configured

**Solution**:
1. Go to worker repo → Settings → Secrets
2. Verify `GITHUB_APP_ID` exists and is correct
3. Verify `GITHUB_APP_PRIVATE_KEY` exists (entire PEM file including headers)

### Issue: "Permission denied"

**Problem**: GitHub App doesn't have required permissions

**Solution**:
1. Go to: https://github.com/settings/apps/YOUR_APP/permissions
2. Set Contents: Read & Write
3. Set Pull requests: Read & Write
4. Save changes
5. **Important**: Go to user's installation and accept new permissions

### Issue: "Could not clone repository"

**Problem**: Installation token doesn't have access

**Solution**:
1. Verify GitHub App is installed on that repository
2. Check installation_id is correct
3. Verify user hasn't removed access

### Issue: "Claude CLI failed"

**Problem**: API key invalid or insufficient credits

**Solution**:
1. Verify API key is correct (not OAuth token)
2. Check Anthropic account has credits
3. Try key in Claude CLI locally first

## Part 8: Production Checklist

Before going live:

### Security
- [ ] Workflow webhook validates signatures (add shared secret)
- [ ] Environment variables are set in Vercel
- [ ] Private key is secure (never committed to git)
- [ ] Worker repository is private (recommended)

### Functionality
- [ ] Test with real repository
- [ ] Test with different problem types
- [ ] Verify PR creation works
- [ ] Test error handling

### Monitoring
- [ ] Add logging to workflow
- [ ] Monitor workflow runs in Actions tab
- [ ] Set up alerts for failures
- [ ] Track job completion rates

### Documentation
- [ ] Update README with setup instructions
- [ ] Add link to worker repository in app
- [ ] Document environment variables

## Summary

**What you need:**

1. ✅ Worker repository with workflow file
2. ✅ GitHub App with correct permissions
3. ✅ Secrets in worker repository
4. ✅ Environment variables in your app

**What users need:**

1. ✅ Install your GitHub App
2. ✅ Configure Claude token in Settings
3. ✅ Submit problems via /fix page

**What happens:**

1. ✅ Your app triggers workflow in YOUR repo
2. ✅ Workflow runs Claude CLI
3. ✅ Creates PR in USER's repo
4. ✅ User's repo stays clean
5. ✅ Everyone happy! 🎉

Need help? Check the workflow runs in your worker repository's Actions tab for detailed logs.
