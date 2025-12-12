# Supabase Edge Function - Git Repo Status Payloads

## Endpoint
```
POST https://riiisqzwbhlytogcjdmn.supabase.co/functions/v1/task-management
```

## All Payloads Sent During Workflow

### 1. **Existing PR Check Complete**
```json
{
  "type": "git_repo_status",
  "job_id": "uuid-here",
  "target_repo": "owner/repo",
  "status": "existing_pr_checked",
  "data": {
    "existing_pr_checked": true,
    "reused_codebase_doc": true
  },
  "timestamp": "2025-12-12T10:30:00Z"
}
```

---

### 2. **RCA Started**
```json
{
  "type": "git_repo_status",
  "job_id": "uuid-here",
  "target_repo": "owner/repo",
  "status": "rca_started",
  "data": {},
  "timestamp": "2025-12-12T10:31:00Z"
}
```

---

### 3. **RCA Completed**
```json
{
  "type": "git_repo_status",
  "job_id": "uuid-here",
  "target_repo": "owner/repo",
  "status": "rca_completed",
  "data": {
    "rca": "# Problem Summary\n\nThe button is misaligned...",
    "rca_edited": false
  },
  "timestamp": "2025-12-12T10:33:00Z"
}
```

**If user provided edited RCA:**
```json
{
  "type": "git_repo_status",
  "job_id": "uuid-here",
  "target_repo": "owner/repo",
  "status": "rca_completed",
  "data": {
    "rca": "# Edited RCA content...",
    "rca_edited": true
  },
  "timestamp": "2025-12-12T10:33:00Z"
}
```

---

### 4. **Code Changes Started**
```json
{
  "type": "git_repo_status",
  "job_id": "uuid-here",
  "target_repo": "owner/repo",
  "status": "code_changes_started",
  "data": {},
  "timestamp": "2025-12-12T10:35:00Z"
}
```

---

### 5. **Code Changes Completed**
```json
{
  "type": "git_repo_status",
  "job_id": "uuid-here",
  "target_repo": "owner/repo",
  "status": "code_changes_completed",
  "data": {
    "files_changed": [
      "src/components/Button.tsx",
      "src/styles/button.css",
      "src/utils/layout.ts"
    ]
  },
  "timestamp": "2025-12-12T10:40:00Z"
}
```

---

### 6. **PR Created**
```json
{
  "type": "git_repo_status",
  "job_id": "uuid-here",
  "target_repo": "owner/repo",
  "status": "pr_created",
  "data": {
    "pr_url": "https://github.com/owner/repo/pull/123",
    "pr_number": 123,
    "branch_name": "claude-fix-1702387200"
  },
  "timestamp": "2025-12-12T10:42:00Z"
}
```

---

### 7. **Completed**
```json
{
  "type": "git_repo_status",
  "job_id": "uuid-here",
  "target_repo": "owner/repo",
  "status": "completed",
  "data": {
    "pr_url": "https://github.com/owner/repo/pull/123",
    "pr_number": 123,
    "branch_name": "claude-fix-1702387200"
  },
  "timestamp": "2025-12-12T10:43:00Z"
}
```

---

### 8. **Failed (No Changes)**
```json
{
  "type": "git_repo_status",
  "job_id": "uuid-here",
  "target_repo": "owner/repo",
  "status": "failed",
  "data": {
    "error_message": "Claude did not make any code changes"
  },
  "timestamp": "2025-12-12T10:40:00Z"
}
```

---

### 9. **Failed (Workflow Error)**
```json
{
  "type": "git_repo_status",
  "job_id": "uuid-here",
  "target_repo": "owner/repo",
  "status": "failed",
  "data": {
    "error_message": "Workflow failed - check GitHub Actions logs"
  },
  "timestamp": "2025-12-12T10:35:00Z"
}
```

---

## Supabase Edge Function Handler Example

```typescript
// supabase/functions/task-management/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface GitRepoStatusPayload {
  type: "git_repo_status";
  job_id: string;
  target_repo: string;
  status: string;
  data: Record<string, any>;
  timestamp: string;
}

serve(async (req) => {
  try {
    const payload: GitRepoStatusPayload = await req.json();

    // Validate type
    if (payload.type !== "git_repo_status") {
      return new Response(
        JSON.stringify({ error: "Invalid type" }),
        { status: 400 }
      );
    }

    console.log(`[${payload.status}] Job ${payload.job_id} - ${payload.target_repo}`);

    // Handle different statuses
    switch (payload.status) {
      case "existing_pr_checked":
        await handleExistingPRCheck(payload);
        break;

      case "rca_started":
        await handleRCAStarted(payload);
        break;

      case "rca_completed":
        await handleRCACompleted(payload);
        break;

      case "code_changes_started":
        await handleCodeChangesStarted(payload);
        break;

      case "code_changes_completed":
        await handleCodeChangesCompleted(payload);
        break;

      case "pr_created":
        await handlePRCreated(payload);
        break;

      case "completed":
        await handleCompleted(payload);
        break;

      case "failed":
        await handleFailed(payload);
        break;

      default:
        console.warn(`Unknown status: ${payload.status}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing git_repo_status:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});

async function handleExistingPRCheck(payload: GitRepoStatusPayload) {
  // Update your database or send notifications
  console.log("PR check:", payload.data);
}

async function handleRCAStarted(payload: GitRepoStatusPayload) {
  console.log("RCA generation started");
}

async function handleRCACompleted(payload: GitRepoStatusPayload) {
  const { rca, rca_edited } = payload.data;
  console.log(`RCA completed (edited: ${rca_edited})`);
  // Store RCA, send to UI, etc.
}

async function handleCodeChangesStarted(payload: GitRepoStatusPayload) {
  console.log("Code changes started");
}

async function handleCodeChangesCompleted(payload: GitRepoStatusPayload) {
  const { files_changed } = payload.data;
  console.log(`Files changed: ${files_changed.length}`);
}

async function handlePRCreated(payload: GitRepoStatusPayload) {
  const { pr_url, pr_number, branch_name } = payload.data;
  console.log(`PR created: #${pr_number} - ${pr_url}`);
  // Send notification, update database, etc.
}

async function handleCompleted(payload: GitRepoStatusPayload) {
  const { pr_url } = payload.data;
  console.log(`Job completed: ${pr_url}`);
  // Final cleanup, notifications, etc.
}

async function handleFailed(payload: GitRepoStatusPayload) {
  const { error_message } = payload.data;
  console.error(`Job failed: ${error_message}`);
  // Error handling, retry logic, notifications, etc.
}
```

---

## Status Flow Timeline

```
1. existing_pr_checked
   ├─ existing_pr_checked: true/false
   └─ reused_codebase_doc: true/false

2. rca_started (if not using user_rca)

3. rca_completed
   ├─ rca: "markdown content"
   └─ rca_edited: true/false

4. code_changes_started

5. code_changes_completed
   └─ files_changed: ["file1.ts", "file2.ts"]

6. pr_created
   ├─ pr_url: "https://..."
   ├─ pr_number: 123
   └─ branch_name: "claude-fix-..."

7. completed
   ├─ pr_url: "https://..."
   ├─ pr_number: 123
   └─ branch_name: "claude-fix-..."

OR

X. failed
   └─ error_message: "reason"
```

---

## Database Schema Example

If you want to store this in Supabase:

```sql
CREATE TABLE git_repo_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  target_repo VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_git_status_job_id ON git_repo_status_events(job_id);
CREATE INDEX idx_git_status_repo ON git_repo_status_events(target_repo);
CREATE INDEX idx_git_status_status ON git_repo_status_events(status);
```

**Insert Example:**
```typescript
const { data, error } = await supabase
  .from('git_repo_status_events')
  .insert({
    job_id: payload.job_id,
    target_repo: payload.target_repo,
    status: payload.status,
    data: payload.data,
  });
```

---

## Real-Time Updates Example

If you want to push updates to frontend:

```typescript
async function handleCodeChangesCompleted(payload: GitRepoStatusPayload) {
  const { files_changed } = payload.data;

  // Store in database
  await supabase
    .from('git_repo_status_events')
    .insert({
      job_id: payload.job_id,
      status: payload.status,
      data: payload.data,
    });

  // Broadcast to connected clients
  const channel = supabase.channel(`job:${payload.job_id}`);
  channel.send({
    type: 'broadcast',
    event: 'status_update',
    payload: {
      status: payload.status,
      files_changed,
    },
  });
}
```

**Frontend Subscribe:**
```typescript
const channel = supabase.channel(`job:${jobId}`);
channel
  .on('broadcast', { event: 'status_update' }, (payload) => {
    console.log('Status update:', payload);
    updateUI(payload);
  })
  .subscribe();
```

---

## Testing Your Edge Function

### Using cURL

```bash
# Test RCA completed event
curl -X POST https://riiisqzwbhlytogcjdmn.supabase.co/functions/v1/task-management \
  -H "Content-Type: application/json" \
  -d '{
    "type": "git_repo_status",
    "job_id": "test-job-123",
    "target_repo": "owner/repo",
    "status": "rca_completed",
    "data": {
      "rca": "# Test RCA\n\nThis is a test.",
      "rca_edited": false
    },
    "timestamp": "2025-12-12T10:00:00Z"
  }'
```

### Using TypeScript

```typescript
async function testStatusUpdate() {
  const response = await fetch(
    'https://riiisqzwbhlytogcjdmn.supabase.co/functions/v1/task-management',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'git_repo_status',
        job_id: 'test-job-123',
        target_repo: 'owner/repo',
        status: 'pr_created',
        data: {
          pr_url: 'https://github.com/owner/repo/pull/123',
          pr_number: 123,
          branch_name: 'claude-fix-1234567890',
        },
        timestamp: new Date().toISOString(),
      }),
    }
  );

  const result = await response.json();
  console.log(result);
}
```

---

## Error Handling

Your Edge Function should handle:

1. **Missing fields:**
```typescript
if (!payload.job_id || !payload.target_repo) {
  return new Response(
    JSON.stringify({ error: "job_id and target_repo required" }),
    { status: 400 }
  );
}
```

2. **Invalid status:**
```typescript
const validStatuses = [
  'existing_pr_checked',
  'rca_started',
  'rca_completed',
  'code_changes_started',
  'code_changes_completed',
  'pr_created',
  'completed',
  'failed',
];

if (!validStatuses.includes(payload.status)) {
  return new Response(
    JSON.stringify({ error: `Invalid status: ${payload.status}` }),
    { status: 400 }
  );
}
```

3. **Database errors:**
```typescript
try {
  await supabase.from('git_repo_status_events').insert({...});
} catch (error) {
  console.error('Database error:', error);
  // Continue anyway - don't fail the workflow
  return new Response(
    JSON.stringify({ success: true, warning: 'DB insert failed' }),
    { status: 200 }
  );
}
```

---

## Monitoring & Logging

```typescript
serve(async (req) => {
  const startTime = Date.now();

  try {
    const payload = await req.json();

    console.log({
      event: 'git_repo_status_received',
      job_id: payload.job_id,
      status: payload.status,
      timestamp: payload.timestamp,
    });

    // ... handle payload

    const duration = Date.now() - startTime;
    console.log({
      event: 'git_repo_status_processed',
      job_id: payload.job_id,
      duration_ms: duration,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error({
      event: 'git_repo_status_error',
      error: error.message,
      duration_ms: duration,
    });

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
```

---

This is the complete payload specification! Let me know if you need any clarification or want me to update the workflow to send these payloads.
