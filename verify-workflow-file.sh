#!/bin/bash

# Verify the workflow file exists and has correct structure

if [ -z "$GITHUB_PAT" ]; then
  echo "❌ GITHUB_PAT not set"
  echo "Usage: export GITHUB_PAT='your-token' && ./verify-workflow-file.sh"
  exit 1
fi

WORKER_REPO="Murali1889/claude-bot-worker"
WORKFLOW_FILE="fix-code.yml"

echo "================================================"
echo "Verifying Workflow File"
echo "================================================"
echo ""
echo "Repository: $WORKER_REPO"
echo "Workflow: .github/workflows/$WORKFLOW_FILE"
echo ""

# 1. Check if file exists
echo "1. Checking if workflow file exists..."
FILE_CHECK=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $GITHUB_PAT" \
  "https://api.github.com/repos/$WORKER_REPO/contents/.github/workflows/$WORKFLOW_FILE")

if [ "$FILE_CHECK" -eq 200 ]; then
  echo "   ✅ File exists"
else
  echo "   ❌ File NOT found (HTTP $FILE_CHECK)"
  echo ""
  echo "   Please create .github/workflows/$WORKFLOW_FILE in $WORKER_REPO"
  echo "   Copy from: fix-code-production.yml"
  exit 1
fi
echo ""

# 2. Get file content
echo "2. Checking workflow content..."
CONTENT=$(curl -s \
  -H "Authorization: Bearer $GITHUB_PAT" \
  "https://api.github.com/repos/$WORKER_REPO/contents/.github/workflows/$WORKFLOW_FILE" \
  | jq -r '.content' | base64 -d 2>/dev/null)

if [ -z "$CONTENT" ]; then
  echo "   ❌ Could not read file content"
  exit 1
fi

# 3. Check for workflow_dispatch
if echo "$CONTENT" | grep -q "workflow_dispatch"; then
  echo "   ✅ Has 'workflow_dispatch' trigger"
else
  echo "   ❌ MISSING 'workflow_dispatch' trigger"
  echo ""
  echo "   The workflow needs this in the 'on:' section:"
  echo "   on:"
  echo "     workflow_dispatch:"
  echo "       inputs: ..."
  exit 1
fi

# 4. Check for required inputs
echo ""
echo "3. Checking required inputs..."

REQUIRED_INPUTS="target_repo problem_statement installation_id job_id api_key"
MISSING=""

for input in $REQUIRED_INPUTS; do
  if echo "$CONTENT" | grep -q "$input:"; then
    echo "   ✅ $input"
  else
    echo "   ❌ MISSING: $input"
    MISSING="$MISSING $input"
  fi
done

if [ -n "$MISSING" ]; then
  echo ""
  echo "   Missing inputs:$MISSING"
  echo "   Please update the workflow file with all required inputs"
  exit 1
fi

# 5. Check workflow name
echo ""
echo "4. Workflow name:"
WORKFLOW_NAME=$(echo "$CONTENT" | grep "^name:" | head -1 | cut -d: -f2- | xargs)
echo "   $WORKFLOW_NAME"

echo ""
echo "================================================"
echo "✅ Workflow file is correctly configured!"
echo "================================================"
echo ""

# 6. Test triggering
echo "5. Testing workflow trigger..."
TRIGGER_RESPONSE=$(curl -s -o /tmp/trigger_response.txt -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $GITHUB_PAT" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$WORKER_REPO/actions/workflows/$WORKFLOW_FILE/dispatches" \
  -d '{
    "ref": "main",
    "inputs": {
      "target_repo": "test/test",
      "problem_statement": "Test workflow verification",
      "installation_id": "123",
      "job_id": "verify-test-'$(date +%s)'",
      "api_key": "test-key"
    }
  }')

if [ "$TRIGGER_RESPONSE" -eq 204 ]; then
  echo "   ✅ Workflow triggered successfully (HTTP 204)"
  echo ""
  echo "   Check workflow runs at:"
  echo "   https://github.com/$WORKER_REPO/actions"
  echo ""
  echo "   A new workflow run should appear within 10-15 seconds"
else
  echo "   ❌ Failed to trigger (HTTP $TRIGGER_RESPONSE)"
  echo ""
  echo "   Response:"
  cat /tmp/trigger_response.txt
  echo ""
fi

rm -f /tmp/trigger_response.txt
