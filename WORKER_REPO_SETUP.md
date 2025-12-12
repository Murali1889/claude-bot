# Worker Repository Setup Guide

## Problem
The workflow trigger is timing out because the worker repository doesn't exist:
- Expected: `Murali1889/claude-bot-worker`
- Status: 404 Not Found

## Solution

### Step 1: Create Worker Repository

1. Go to GitHub: https://github.com/new
2. Repository name: `claude-bot-worker`
3. Make it **Public** (so GitHub Actions can run)
4. Initialize with README
5. Click "Create repository"

### Step 2: Add Workflow File

Create `.github/workflows/fix-code.yml` in the new repository with this content:

```bash
# Copy the production workflow file
cp /Users/muralivvrsngurajapu/claude-bot/fix-code-production.yml fix-code.yml
```

Then commit and push:

```bash
cd /path/to/claude-bot-worker
mkdir -p .github/workflows
mv fix-code.yml .github/workflows/
git add .github/workflows/fix-code.yml
git commit -m "Add Claude fix-code workflow"
git push origin main
```

### Step 3: Configure GitHub Secrets

In the worker repository, add these secrets (Settings → Secrets → Actions):

1. `APP_ID` - Your GitHub App ID
2. `APP_PRIVATE_KEY` - Your GitHub App private key
3. `GITHUB_PAT` - Personal Access Token with `workflow` scope

### Step 4: Verify Configuration

The executor service is configured to use:
- Worker Owner: `Murali1889` (from `WORKER_REPO_OWNER` env var)
- Worker Repo: `claude-bot-worker` (from `WORKER_REPO_NAME` env var)

Update these in your `.env` if needed:
```bash
WORKER_REPO_OWNER=Murali1889
WORKER_REPO_NAME=claude-bot-worker
```

---

## Alternative: Use Different Repository

If you want to use a different repository (e.g., the current `claude-bot` repo), update your environment variables:

```bash
# In Vercel or wherever your Next.js app is deployed
WORKER_REPO_OWNER=Muralivvrsn  # or your GitHub username
WORKER_REPO_NAME=claude-bot     # your existing repo
```

Then the workflow will trigger in that repository instead.

---

## Quick Test

After setting up, test the workflow trigger:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_GITHUB_PAT" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/Murali1889/claude-bot-worker/actions/workflows/fix-code.yml/dispatches" \
  -d '{
    "ref": "main",
    "inputs": {
      "target_repo": "test/test",
      "problem_statement": "test",
      "installation_id": "123",
      "job_id": "test-job",
      "api_key": "test-key"
    }
  }'
```

Expected response: `204 No Content` (success)
If you get `404`: Repository or workflow doesn't exist
If you get `403`: Token doesn't have permissions

---

## Checklist

- [ ] Repository `Murali1889/claude-bot-worker` created
- [ ] Workflow file `.github/workflows/fix-code.yml` added
- [ ] GitHub App secrets configured (APP_ID, APP_PRIVATE_KEY)
- [ ] GITHUB_PAT secret configured with `workflow` scope
- [ ] Environment variables set correctly in deployed app
- [ ] Test workflow trigger returns 204
