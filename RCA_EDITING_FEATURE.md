# RCA Editing and Regeneration Feature

## Overview

This feature allows users to edit the Root Cause Analysis (RCA) after the initial workflow run and regenerate code changes based on the updated RCA. This prevents unnecessary RCA regeneration and focuses only on code changes with the improved analysis.

## User Flow

1. **Initial Workflow Run**
   - User submits a fix job
   - Workflow generates RCA and code changes
   - Creates PR with both RCA and code

2. **View and Edit RCA**
   - User views the RCA in the dashboard
   - If RCA needs improvement, user clicks "Edit RCA"
   - User edits the RCA in a modal editor
   - User clicks "Regenerate Code"

3. **Regeneration**
   - System triggers workflow with edited RCA
   - Workflow skips RCA generation
   - Workflow regenerates code changes using edited RCA
   - Creates new PR with updated code

## Technical Implementation

### Database Schema

New columns added to `fix_jobs` table:

```sql
-- RCA editing fields
user_edited_rca TEXT              -- User's edited version of RCA
rca_edited BOOLEAN DEFAULT FALSE  -- Whether RCA was edited
regeneration_count INTEGER DEFAULT 0  -- Number of regenerations
```

**Migration File**: `schema/apply-rca-editing.sql`

Run this in Supabase SQL Editor to add the columns.

### Backend API

#### Regeneration Endpoint

**File**: `frontend/app/api/fix/regenerate/route.ts`

**Endpoint**: `POST /api/fix/regenerate`

**Request Body**:
```json
{
  "job_id": "uuid",
  "edited_rca": "Updated RCA content in markdown..."
}
```

**Response**:
```json
{
  "success": true,
  "message": "Code regeneration started with edited RCA",
  "job_id": "uuid",
  "regeneration_count": 1
}
```

**What it does**:
1. Validates job ownership
2. Updates job with edited RCA
3. Increments regeneration count
4. Triggers workflow with `user_rca` and `regeneration=true` parameters

### Workflow Service Updates

**File**: `frontend/lib/executor-service-workflow.ts`

**New Parameters**:
- `userRca?: string` - User-edited RCA content
- `regeneration?: boolean` - Whether this is a regeneration

**Workflow**: Uses `fix-code-production.yml` (supports RCA editing)

**Workflow Inputs**:
```yaml
user_rca:
  description: 'User-edited RCA (optional - if provided, skip RCA generation)'
  required: false
  type: string
  default: ''

regeneration:
  description: 'Is this a regeneration after RCA edit?'
  required: false
  type: boolean
  default: false
```

### Frontend UI

#### RCA Editor Component

**File**: `frontend/app/dashboard/RCAEditor.tsx`

**Features**:
- Full-screen modal editor
- Edit/Preview tabs
- Real-time change detection
- Error handling
- Loading states
- Markdown preview

**Props**:
```typescript
interface RCAEditorProps {
  jobId: string;
  originalRca: string;
  onClose: () => void;
  onRegenerate?: () => void;
}
```

#### Dashboard Integration

**File**: `frontend/app/dashboard/DashboardClient.tsx`

**Updates**:
1. Added `editingRca` state for modal control
2. Added "Edit RCA" button next to each RCA display
3. Shows regeneration count badge if RCA was edited
4. Integrated RCAEditor modal
5. Real-time job updates via Supabase subscriptions

**New FixJob Interface Fields**:
```typescript
user_edited_rca: string | null;
rca_edited: boolean;
regeneration_count: number;
```

### Production Workflow

**File**: `fix-code-production.yml`

**Key Features**:

1. **Conditional RCA Generation**
   ```yaml
   - name: Generate Root Cause Analysis
     if: inputs.user_rca == ''  # Skip if user provided RCA
   ```

2. **Use User-Edited RCA**
   ```yaml
   - name: Use User-Edited RCA
     if: inputs.user_rca != ''
     run: |
       cat > RCA.md <<'RCAEOF'
       ${{ inputs.user_rca }}
       RCAEOF
   ```

3. **Smart code_base.md Reuse**
   - Checks existing open PRs from Claude Bot
   - Reuses code_base.md if found
   - Avoids regenerating documentation

4. **Sonnet-Only Model**
   - Uses Claude Sonnet 4.5 for all phases
   - Consistent quality across RCA and code

5. **Regeneration Tracking**
   - Adds regeneration note to PR description
   - Shows regeneration count in PR body
   - Indicates if code_base.md was reused

## Setup Instructions

### 1. Apply Database Migration

```bash
# In Supabase SQL Editor, run:
# schema/apply-rca-editing.sql
```

This adds the necessary columns to track RCA editing.

### 2. Deploy Production Workflow

The production workflow file `fix-code-production.yml` needs to be deployed to your worker repository:

**Worker Repository**: `Muralivvrsn/claude-bot-worker`
**Target Path**: `.github/workflows/fix-code-production.yml`

```bash
# Copy workflow to worker repository
cp fix-code-production.yml /path/to/claude-bot-worker/.github/workflows/

# Commit and push
cd /path/to/claude-bot-worker
git add .github/workflows/fix-code-production.yml
git commit -m "Add production workflow with RCA editing support"
git push origin main
```

### 3. Verify Environment Variables

Ensure these are set in your environment:

**Vercel Environment Variables** (for the Next.js app):
```bash
ENCRYPTION_KEY=<your-encryption-key>
GITHUB_PAT=<your-github-personal-access-token>
WORKER_REPO_OWNER=Muralivvrsn  # Optional, defaults to this
WORKER_REPO_NAME=claude-bot-worker  # Optional, defaults to this
```

**GitHub Actions Secrets** (in worker repository):
```bash
APP_ID=<github-app-id>
APP_PRIVATE_KEY=<github-app-private-key>
```

### 4. Test the Feature

1. **Create a test fix job**
   ```bash
   # Go to your app
   # Create a new fix job
   # Wait for it to complete
   ```

2. **Edit the RCA**
   ```bash
   # Click on completed job in dashboard
   # Click "Edit RCA" button
   # Make changes to the RCA
   # Click "Regenerate Code"
   ```

3. **Verify regeneration**
   ```bash
   # Check worker repository actions
   # https://github.com/Muralivvrsn/claude-bot-worker/actions

   # Verify new PR is created
   # Check PR description shows regeneration note
   ```

## Usage Examples

### Example 1: Simple RCA Edit

**Original RCA**:
```markdown
## Problem
The login button is broken

## Root Cause
Missing event handler

## Solution
Add onClick handler
```

**Edited RCA**:
```markdown
## Problem
The login button is broken

## Root Cause
Missing event handler AND incorrect form validation

## Solution
1. Add onClick handler
2. Fix form validation regex
3. Add error boundary
```

**Result**: Code will be regenerated with all three changes.

### Example 2: Adding More Context

**Original RCA**:
```markdown
Fix the API timeout
```

**Edited RCA**:
```markdown
## Problem
API calls are timing out after 5 seconds

## Root Cause
1. No retry logic
2. Inefficient database queries
3. Missing connection pooling

## Files to Change
- api/handlers/user.ts - Add retry logic
- db/queries.ts - Optimize queries
- db/connection.ts - Add pooling

## Solution
Implement exponential backoff retry with optimized queries
```

**Result**: Much more comprehensive code changes.

## Monitoring and Debugging

### Check Job Status

```typescript
// Query job in Supabase
SELECT
  id,
  status,
  rca_edited,
  regeneration_count,
  user_edited_rca
FROM fix_jobs
WHERE id = 'your-job-id';
```

### Check Workflow Runs

```bash
# GitHub CLI
gh run list --repo Muralivvrsn/claude-bot-worker

# Web UI
https://github.com/Muralivvrsn/claude-bot-worker/actions
```

### View Logs

```bash
# In Vercel
vercel logs

# Check specific endpoint
vercel logs --follow | grep regenerate
```

## Cost Optimization

### Before RCA Editing:
- User unhappy with RCA → Delete job → Create new job
- **Cost**: Full RCA generation + Code changes = ~$0.34

### After RCA Editing:
- User edits RCA → Regenerate code only
- **Cost**: Code changes only = ~$0.15 (56% savings)

### Additional Savings:
- **code_base.md reuse**: If other PRs exist, reuses documentation
- **Savings**: ~$0.08 per regeneration
- **Total savings on regeneration**: ~$0.19 (56% reduction)

## Troubleshooting

### Issue: "Job not found or access denied"

**Cause**: User doesn't own the job
**Solution**: Ensure user is authenticated and owns the job

### Issue: Workflow not triggering

**Cause**:
1. Workflow file not in worker repo
2. GITHUB_PAT not configured
3. Invalid repository name

**Solution**:
```bash
# Check environment variables
vercel env ls

# Verify workflow exists
https://github.com/Muralivvrsn/claude-bot-worker/tree/main/.github/workflows

# Check logs
vercel logs | grep triggerWorkflow
```

### Issue: RCA editor not opening

**Cause**:
1. Missing RCA in job
2. JavaScript error
3. Modal state not updated

**Solution**:
```bash
# Check browser console
# Verify job has RCA
# Check DashboardClient state
```

### Issue: Regeneration count not incrementing

**Cause**: Database column not added
**Solution**:
```sql
-- Run migration
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'fix_jobs'
AND column_name = 'regeneration_count';

-- If empty, run migration
-- schema/apply-rca-editing.sql
```

## Future Enhancements

1. **RCA Version History**
   - Track all RCA versions
   - Allow reverting to previous versions
   - Show diff between versions

2. **Collaborative Editing**
   - Multiple users can suggest RCA edits
   - Approval workflow before regeneration
   - Comments on RCA sections

3. **AI-Assisted RCA Improvement**
   - Suggest improvements to RCA
   - Highlight missing information
   - Validate RCA completeness

4. **A/B Testing**
   - Generate code for multiple RCA versions
   - Compare results
   - Choose best implementation

## Related Files

### Backend
- `frontend/app/api/fix/regenerate/route.ts` - Regeneration API endpoint
- `frontend/lib/executor-service-workflow.ts` - Workflow trigger service

### Frontend
- `frontend/app/dashboard/RCAEditor.tsx` - RCA editor component
- `frontend/app/dashboard/DashboardClient.tsx` - Dashboard with editing

### Database
- `schema/apply-rca-editing.sql` - Migration script
- `schema/phase3-rca-edit.sql` - Original schema definition

### Workflow
- `fix-code-production.yml` - Production workflow with RCA editing

### Documentation
- `RCA_EDITING_FEATURE.md` - This file
- `COST_OPTIMIZATION.md` - Cost analysis
- `CLASSIFICATION_GUIDE.md` - Problem classification

## Support

For issues or questions:
1. Check Vercel logs: `vercel logs`
2. Check worker repository actions: https://github.com/Muralivvrsn/claude-bot-worker/actions
3. Check Supabase logs in dashboard
4. Verify environment variables are set correctly
