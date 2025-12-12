# Deployment Status - Workflow Timeout Fix

## ✅ Changes Pushed (Commit 579c517)

### What Was Fixed:

1. **Enhanced Error Handling**
   - Pre-check: Verifies workflow file exists before triggering
   - Rate limit monitoring: Logs remaining API calls
   - Detailed errors: Shows exact GitHub API error (404/403/422)
   - Better logging: PAT prefix, response status, headers

2. **Slack Context Support**
   - Added `slack_context` (JSONB) column to `fix_jobs` table
   - Stores Slack thread/channel info for jobs triggered from Slack
   - See: `schema/add-slack-context.sql`

3. **Manual Test Cases in PRs**
   - RCA now includes detailed manual test cases
   - Extracted and displayed prominently in PR body
   - Reviewers get step-by-step testing instructions

4. **PR Check Fix**
   - Now explicitly targets correct repository with `--repo` flag
   - Prevents checking wrong repository for existing PRs

5. **Documentation**
   - `WORKER_REPO_SETUP.md` - Worker repository setup guide
   - `check-github-status.sh` - Diagnostic script

---

## 🔧 Next Steps

### 1. Run Diagnostic Script

```bash
export GITHUB_PAT='your-github-pat-here'
./check-github-status.sh
```

This will check:
- ✅ Rate limits (remaining API calls)
- ✅ PAT scopes (workflow permission)
- ✅ Worker repository exists
- ✅ Workflow file exists
- ✅ Test workflow trigger

### 2. Common Issues & Fixes

#### Issue: Rate Limit Exceeded
**Symptoms:** Timeout after 30 seconds, rate limit = 0

**Fix:**
```bash
# Check rate limit
curl -H "Authorization: Bearer $GITHUB_PAT" \
  https://api.github.com/rate_limit | jq '.resources.core'

# Wait for reset, or use different PAT
```

#### Issue: Missing 'workflow' Scope
**Symptoms:** 403 Forbidden error

**Fix:**
1. Go to https://github.com/settings/tokens
2. Find your token (or create new one)
3. Check the `workflow` box
4. Regenerate token
5. Update `GITHUB_PAT` in Vercel environment variables
6. Redeploy

#### Issue: Workflow File Not Found
**Symptoms:** 404 Not Found error

**Fix:**
```bash
# Check if file exists
curl -H "Authorization: Bearer $GITHUB_PAT" \
  https://api.github.com/repos/Murali1889/claude-bot-worker/contents/.github/workflows/fix-code.yml

# If 404, create it:
# 1. Copy fix-code-production.yml to worker repo
# 2. Save as .github/workflows/fix-code.yml
# 3. Commit and push
```

---

## 📊 Deployment

### Automatic Deployment (Vercel)

Since you pushed to `main`, Vercel will automatically deploy:
1. **Build time:** ~2-3 minutes
2. **Check status:** https://vercel.com/dashboard
3. **Once deployed:** Try creating a fix job

### What You'll See Now

**Better Logs:**
```
[triggerWorkflow] Verifying workflow file exists...
[triggerWorkflow] ✅ Workflow file exists
[triggerWorkflow] Using PAT: ghp_HULgmI... (length: 82)
[triggerWorkflow] Making POST request to GitHub API...
[triggerWorkflow] ✅ Response received: 204 No Content
[triggerWorkflow] Rate limit remaining: 4987
[triggerWorkflow] ✅ Successfully triggered workflow
```

**If Error:**
```
[triggerWorkflow] ❌ GitHub API Error Response: {
  "message": "Resource not accessible by personal access token",
  "documentation_url": "..."
}
[triggerWorkflow] ❌ Permission denied: GITHUB_PAT may lack 'workflow' scope
```

---

## 🧪 Testing

### Manual Test
```bash
# Test the workflow trigger directly
curl -X POST \
  -H "Authorization: Bearer $GITHUB_PAT" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/Murali1889/claude-bot-worker/actions/workflows/fix-code.yml/dispatches \
  -d '{
    "ref": "main",
    "inputs": {
      "target_repo": "test/test",
      "problem_statement": "test",
      "installation_id": "123",
      "job_id": "test-123",
      "api_key": "test"
    }
  }'

# Expected: HTTP 204 (success)
# If error: Check response body for details
```

---

## 🎯 Summary

**Status:** ✅ Code pushed and deploying

**Wait for:** Vercel deployment (~2-3 min)

**Then:** Try creating a fix job and check logs

**If still failing:** Run `./check-github-status.sh` to diagnose

---

## 📞 Quick Checks

```bash
# 1. Is deployment done?
curl https://your-app.vercel.app/api/health

# 2. Check rate limits
curl -H "Authorization: Bearer $GITHUB_PAT" \
  https://api.github.com/rate_limit | jq '.resources.core'

# 3. Check PAT scopes
curl -I -H "Authorization: Bearer $GITHUB_PAT" \
  https://api.github.com/user | grep x-oauth-scopes

# 4. Verify workflow exists
curl -H "Authorization: Bearer $GITHUB_PAT" \
  https://api.github.com/repos/Murali1889/claude-bot-worker/contents/.github/workflows/fix-code.yml
```

---

**Most Likely Issue:** Rate limit or PAT scope. Run the diagnostic script to check! 🔍
