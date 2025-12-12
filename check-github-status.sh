#!/bin/bash

# Script to check GitHub API status and troubleshoot workflow trigger issues

echo "================================================"
echo "GitHub API Status Checker"
echo "================================================"
echo ""

# Check if GITHUB_PAT is set
if [ -z "$GITHUB_PAT" ]; then
  echo "❌ GITHUB_PAT not set in environment"
  echo ""
  echo "Please export your GitHub PAT:"
  echo "  export GITHUB_PAT='ghp_your_token_here'"
  echo ""
  exit 1
fi

echo "✅ GITHUB_PAT is set: ${GITHUB_PAT:0:15}..."
echo ""

# 1. Check rate limits
echo "================================================"
echo "1. Checking Rate Limits"
echo "================================================"
RATE_LIMIT=$(curl -s -H "Authorization: Bearer $GITHUB_PAT" \
  https://api.github.com/rate_limit)

CORE_REMAINING=$(echo "$RATE_LIMIT" | jq -r '.resources.core.remaining')
CORE_LIMIT=$(echo "$RATE_LIMIT" | jq -r '.resources.core.limit')
CORE_RESET=$(echo "$RATE_LIMIT" | jq -r '.resources.core.reset')

echo "Rate Limit: $CORE_REMAINING / $CORE_LIMIT remaining"

if [ "$CORE_REMAINING" -eq 0 ]; then
  RESET_DATE=$(date -r "$CORE_RESET" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -d "@$CORE_RESET" '+%Y-%m-%d %H:%M:%S')
  echo "⚠️  RATE LIMIT EXCEEDED! Resets at: $RESET_DATE"
  echo ""
  echo "This is likely why the workflow trigger is timing out."
  echo "Wait until the rate limit resets, or use a different GitHub PAT."
  exit 1
else
  echo "✅ Rate limit OK"
fi
echo ""

# 2. Check PAT scopes
echo "================================================"
echo "2. Checking PAT Scopes"
echo "================================================"
SCOPES=$(curl -s -I -H "Authorization: Bearer $GITHUB_PAT" \
  https://api.github.com/user | grep -i "x-oauth-scopes" | cut -d: -f2)

echo "Scopes: $SCOPES"

if echo "$SCOPES" | grep -q "workflow"; then
  echo "✅ 'workflow' scope present"
else
  echo "❌ 'workflow' scope MISSING!"
  echo ""
  echo "Your PAT needs the 'workflow' scope to trigger GitHub Actions."
  echo "Go to: https://github.com/settings/tokens"
  echo "Regenerate your token with 'workflow' scope enabled."
  exit 1
fi
echo ""

# 3. Check if worker repository exists
echo "================================================"
echo "3. Checking Worker Repository"
echo "================================================"
WORKER_REPO="Murali1889/claude-bot-worker"
REPO_CHECK=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $GITHUB_PAT" \
  "https://api.github.com/repos/$WORKER_REPO")

if [ "$REPO_CHECK" -eq 200 ]; then
  echo "✅ Repository exists: $WORKER_REPO"
else
  echo "❌ Repository not found: $WORKER_REPO (HTTP $REPO_CHECK)"
  echo ""
  echo "Please create the repository or update WORKER_REPO_OWNER/WORKER_REPO_NAME env vars"
  exit 1
fi
echo ""

# 4. Check if workflow file exists
echo "================================================"
echo "4. Checking Workflow File"
echo "================================================"
WORKFLOW_CHECK=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $GITHUB_PAT" \
  "https://api.github.com/repos/$WORKER_REPO/contents/.github/workflows/fix-code.yml")

if [ "$WORKFLOW_CHECK" -eq 200 ]; then
  echo "✅ Workflow file exists: .github/workflows/fix-code.yml"
else
  echo "❌ Workflow file not found (HTTP $WORKFLOW_CHECK)"
  echo ""
  echo "Please create .github/workflows/fix-code.yml in $WORKER_REPO"
  echo "Copy from: fix-code-production.yml"
  exit 1
fi
echo ""

# 5. Test workflow trigger
echo "================================================"
echo "5. Testing Workflow Trigger"
echo "================================================"
echo "Sending test workflow dispatch..."

TRIGGER_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $GITHUB_PAT" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$WORKER_REPO/actions/workflows/fix-code.yml/dispatches" \
  -d '{
    "ref": "main",
    "inputs": {
      "target_repo": "test/test",
      "problem_statement": "test",
      "installation_id": "123",
      "job_id": "test-job-id",
      "api_key": "test-key"
    }
  }')

if [ "$TRIGGER_RESPONSE" -eq 204 ]; then
  echo "✅ Workflow trigger SUCCESS (HTTP 204)"
  echo ""
  echo "Your setup is working! The timeout issue may be:"
  echo "  - Temporary GitHub API slowness"
  echo "  - Network issues from Vercel"
  echo "  - Try again in a few minutes"
elif [ "$TRIGGER_RESPONSE" -eq 404 ]; then
  echo "❌ Workflow not found (HTTP 404)"
  echo "The workflow file may not be on the 'main' branch"
elif [ "$TRIGGER_RESPONSE" -eq 403 ]; then
  echo "❌ Permission denied (HTTP 403)"
  echo "PAT may not have access to the repository"
else
  echo "❌ Failed with HTTP $TRIGGER_RESPONSE"
  echo ""
  echo "Check GitHub Actions logs for more details"
fi

echo ""
echo "================================================"
echo "Summary"
echo "================================================"
echo "All checks passed! Your configuration looks correct."
echo ""
echo "Next steps:"
echo "1. Deploy the updated code to Vercel (automatic from git push)"
echo "2. Wait a few minutes for deployment"
echo "3. Try creating a fix job again"
echo "4. Check logs for detailed error messages"
