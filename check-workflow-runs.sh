#!/bin/bash

# Check recent workflow runs in the worker repository

if [ -z "$GITHUB_PAT" ]; then
  echo "❌ GITHUB_PAT not set"
  echo "Usage: export GITHUB_PAT='your-token' && ./check-workflow-runs.sh"
  exit 1
fi

WORKER_REPO="${1:-Murali1889/claude-bot-worker}"

echo "================================================"
echo "Checking Workflow Runs in $WORKER_REPO"
echo "================================================"
echo ""

# Get recent workflow runs
echo "Recent workflow runs:"
curl -s \
  -H "Authorization: Bearer $GITHUB_PAT" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$WORKER_REPO/actions/runs?per_page=5" \
  | jq -r '.workflow_runs[] | "\(.id) | \(.status) | \(.conclusion // "running") | \(.created_at) | \(.name)"' \
  | column -t -s '|'

echo ""
echo "================================================"
echo "Checking Workflow Dispatches"
echo "================================================"
echo ""

# Try to trigger a test workflow
echo "Triggering test workflow..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $GITHUB_PAT" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$WORKER_REPO/actions/workflows/fix-code.yml/dispatches" \
  -d '{
    "ref": "main",
    "inputs": {
      "target_repo": "test/test",
      "problem_statement": "Test workflow trigger",
      "installation_id": "123",
      "job_id": "test-'$(date +%s)'",
      "api_key": "test-key"
    }
  }')

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)

if [ "$HTTP_CODE" -eq 204 ]; then
  echo "✅ Workflow triggered successfully (HTTP 204)"
  echo ""
  echo "Wait 5 seconds and check for new run..."
  sleep 5

  echo ""
  echo "Latest workflow runs:"
  curl -s \
    -H "Authorization: Bearer $GITHUB_PAT" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$WORKER_REPO/actions/runs?per_page=3" \
    | jq -r '.workflow_runs[] | "\(.id) | \(.status) | \(.conclusion // "running") | \(.created_at) | \(.name)"' \
    | column -t -s '|'
else
  echo "❌ Failed to trigger workflow (HTTP $HTTP_CODE)"
  echo ""
  echo "Response:"
  echo "$RESPONSE" | grep -v "HTTP_CODE:"
fi

echo ""
echo "================================================"
echo "Check workflow runs at:"
echo "https://github.com/$WORKER_REPO/actions"
echo "================================================"
