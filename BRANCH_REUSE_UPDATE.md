# Branch Reuse Feature - Updated Flow

## 🎯 Problem Solved

**Before:** Each regeneration created a new branch and new PR
- User edits RCA → New branch (`claude-fix-regen-123456`)
- New PR created → Multiple PRs for same issue
- Confusing for users and reviewers

**After:** Regeneration reuses existing branch and updates same PR
- User edits RCA → Reuses branch (`claude-fix-123456`)
- Existing PR updated → Single PR with latest changes
- Clean, organized, easy to review

---

## ✅ What Changed

### 1. **Branch Management** (`fix-code-production.yml`)

**Old Flow:**
```yaml
- name: Create Fix Branch
  run: |
    if [ "${{ inputs.regeneration }}" = "true" ]; then
      BRANCH_NAME="claude-fix-regen-$(date +%s)"  # NEW BRANCH
    else
      BRANCH_NAME="claude-fix-$(date +%s)"
    fi
    git checkout -b "$BRANCH_NAME"
```

**New Flow:**
```yaml
- name: Create or Reuse Fix Branch
  run: |
    if [ "${{ inputs.regeneration }}" = "true" ]; then
      # Find existing branch
      EXISTING_BRANCH=$(git branch -r | grep "origin/claude-fix-" | head -1)

      if [ -n "$EXISTING_BRANCH" ]; then
        # REUSE existing branch
        git checkout "$EXISTING_BRANCH"
        git pull origin "$EXISTING_BRANCH"
      else
        # Create new if not found
        BRANCH_NAME="claude-fix-$(date +%s)"
        git checkout -b "$BRANCH_NAME"
      fi
    else
      # First run - create new
      BRANCH_NAME="claude-fix-$(date +%s)"
      git checkout -b "$BRANCH_NAME"
    fi
```

---

### 2. **Push Strategy** (`fix-code-production.yml`)

**Old Flow:**
```yaml
- name: Push Branch
  run: |
    git push -u origin "$BRANCH_NAME"  # Always normal push
```

**New Flow:**
```yaml
- name: Push Branch
  run: |
    if [ "${{ inputs.regeneration }}" = "true" ]; then
      git push -f origin "$BRANCH_NAME"  # Force push to update
    else
      git push -u origin "$BRANCH_NAME"  # Normal push for new
    fi
```

**Why force push?**
- Existing branch already has commits
- Need to replace with new changes
- Force push updates the branch and PR automatically

---

### 3. **PR Management** (`fix-code-production.yml`)

**Old Flow:**
```yaml
- name: Create Pull Request
  run: |
    # Always create new PR
    gh pr create --title "$PR_TITLE" --body "$PR_BODY"
```

**New Flow:**
```yaml
- name: Create or Update Pull Request
  run: |
    # Check if PR exists for this branch
    EXISTING_PR=$(gh pr list --head "$BRANCH_NAME" --json number)

    if [ -n "$EXISTING_PR" ]; then
      # UPDATE existing PR
      gh pr edit "$EXISTING_PR" --body "$PR_BODY"
      echo "✅ Pull request updated"
    else
      # CREATE new PR
      gh pr create --title "$PR_TITLE" --body "$PR_BODY"
      echo "✅ Pull request created"
    fi
```

---

### 4. **Database Schema** (`schema/apply-rca-editing.sql`)

**Added Index:**
```sql
CREATE INDEX IF NOT EXISTS idx_fix_jobs_branch_name ON fix_jobs(branch_name);
```

**Why?** Enables fast lookup of branch names for regeneration

---

## 🔄 Updated Flow Diagrams

### **First Run (Initial Fix)**

```
User creates fix job
    ↓
Workflow triggered
    ↓
Create NEW branch: claude-fix-1234567890
    ↓
Generate RCA
    ↓
Make code changes
    ↓
Commit & push
    ↓
CREATE new PR #123
    ↓
Store branch_name in database
    ↓
✅ PR #123 created on branch claude-fix-1234567890
```

---

### **Regeneration (RCA Edited)**

```
User edits RCA in dashboard
    ↓
Click "Regenerate Code"
    ↓
Workflow triggered with regeneration=true
    ↓
Find existing branch: claude-fix-1234567890
    ↓
Checkout existing branch
    ↓
Pull latest changes
    ↓
Skip RCA generation (use edited RCA)
    ↓
Make NEW code changes
    ↓
Commit changes
    ↓
FORCE PUSH to existing branch
    ↓
Find existing PR #123 for this branch
    ↓
UPDATE PR #123 body with new changes
    ↓
✅ PR #123 updated with regenerated code
```

---

## 📊 Before vs After Comparison

| Aspect | Before | After |
|--------|--------|-------|
| **Branch** | New branch each time | Reuse same branch |
| | `claude-fix-123` | `claude-fix-123` |
| | `claude-fix-regen-456` | `claude-fix-123` (same) |
| | `claude-fix-regen-789` | `claude-fix-123` (same) |
| **PR** | New PR each time | Update same PR |
| | PR #1, PR #2, PR #3... | PR #1 (updated) |
| **User Experience** | Confusing, multiple PRs | Clean, single PR |
| **Review** | Hard to track changes | Easy to see evolution |
| **Cleanup** | Must close old PRs | Automatic |

---

## 💡 Benefits

### For Users:
✅ **Single source of truth** - One PR per fix
✅ **Clear history** - See how RCA evolved
✅ **Easy review** - All changes in one place
✅ **No cleanup** - No need to close old PRs

### For Reviewers:
✅ **Track iterations** - See all regenerations in PR timeline
✅ **Compare versions** - GitHub shows force-push history
✅ **Cleaner repo** - No abandoned branches/PRs

### For System:
✅ **Less storage** - Fewer branches
✅ **Simpler tracking** - One job = one branch = one PR
✅ **Better organization** - Predictable structure

---

## 🔍 How It Works Technically

### Finding Existing Branch

```bash
# Search for remote branches matching pattern
EXISTING_BRANCH=$(git branch -r | grep "origin/claude-fix-" | head -1)

# Result examples:
# - First run: "" (empty, no match)
# - Regeneration: "origin/claude-fix-1234567890"
```

### Checking Out Existing Branch

```bash
if [ -n "$EXISTING_BRANCH" ]; then
  # Remove "origin/" prefix
  BRANCH_NAME=$(echo "$EXISTING_BRANCH" | sed 's/origin\///')

  # Fetch latest
  git fetch origin "$BRANCH_NAME"

  # Checkout
  git checkout "$BRANCH_NAME"

  # Pull latest commits
  git pull origin "$BRANCH_NAME"
fi
```

### Force Pushing Changes

```bash
# Make new commits
git add -A
git commit -m "fix: regenerated with updated RCA"

# Force push to replace existing commits
git push -f origin "$BRANCH_NAME"
```

**What happens:**
- Old commits replaced with new ones
- PR automatically shows new changes
- GitHub tracks force-push in PR timeline

### Updating PR

```bash
# Find PR for this branch
EXISTING_PR=$(gh pr list --head "$BRANCH_NAME" --json number --jq '.[0].number')

if [ -n "$EXISTING_PR" ]; then
  # Update PR description
  gh pr edit "$EXISTING_PR" --body "$NEW_PR_BODY"

  # PR now shows:
  # - Updated description
  # - New commits (from force push)
  # - Regeneration timestamp
fi
```

---

## 📝 PR Timeline Example

**Initial PR Creation:**
```
Claude Bot created PR #123
Branch: claude-fix-1234567890
─────────────────────────────
Initial RCA and code changes
Files: app.tsx, utils.ts
```

**After 1st Regeneration:**
```
Claude Bot force-pushed to claude-fix-1234567890
─────────────────────────────
🔄 Regeneration
Updated at: 2025-12-12 10:30:00 UTC

Updated RCA:
- Improved analysis
- Better solution approach

Files: app.tsx, utils.ts, config.ts
```

**After 2nd Regeneration:**
```
Claude Bot force-pushed to claude-fix-1234567890
─────────────────────────────
🔄 Regeneration
Updated at: 2025-12-12 11:45:00 UTC

Updated RCA:
- Final refinements
- Edge cases covered

Files: app.tsx, utils.ts, config.ts, tests.ts
```

---

## 🚀 Usage Example

### Scenario: UI Bug Fix

#### Step 1: Initial Fix
```
User: "Button is misaligned on mobile"
    ↓
System creates: Branch "claude-fix-1702387200"
System creates: PR #45
    ↓
PR shows: Initial RCA + code changes
```

#### Step 2: RCA Review
```
User reviews PR #45
User thinks: "RCA missed the root cause"
User clicks: "Edit RCA"
    ↓
User adds: "The real issue is flexbox not grid"
User clicks: "Regenerate Code"
```

#### Step 3: Regeneration
```
System reuses: Branch "claude-fix-1702387200"
System updates: PR #45
    ↓
PR #45 now shows:
- Updated RCA (better analysis)
- New code changes (uses grid)
- Regeneration timestamp
```

#### Step 4: Another Iteration
```
User: "Almost there, but need responsive breakpoints"
User edits RCA again
User regenerates
    ↓
System reuses: Same branch
System updates: Same PR #45
    ↓
PR #45 now shows:
- Latest RCA
- Latest code with breakpoints
- 2 regenerations
```

**Result:** Single PR #45 with complete evolution, easy to review!

---

## ⚠️ Important Notes

### Branch Detection Logic

The workflow searches for branches matching pattern `claude-fix-*`:

```bash
git branch -r | grep "origin/claude-fix-"
```

**Important:**
- Takes the **first** match (most recent)
- Assumes one active fix per repository
- If multiple active fixes exist, may pick wrong branch

**Future Enhancement:**
Store `branch_name` in database and pass it to workflow:

```typescript
// In regenerate API
const { branch_name } = existingJob;

await executeFix({
  // ...
  branchName: branch_name,  // Pass exact branch
});
```

### Force Push Considerations

**Safe because:**
- ✅ Only bot creates these branches
- ✅ No human commits mixed in
- ✅ PR preserves history via force-push timeline

**Be careful:**
- ⚠️ Don't manually commit to `claude-fix-*` branches
- ⚠️ Force push will overwrite manual changes

### PR Update Timing

PR updates **immediately** when branch is force-pushed:
1. Workflow force-pushes → GitHub detects change
2. Workflow updates PR body → GitHub shows new description
3. User sees updated PR instantly

---

## 🐛 Troubleshooting

### Issue: "No existing branch found"

**Symptoms:**
- Regeneration creates new branch instead of reusing
- Multiple PRs for same issue

**Causes:**
1. Branch was deleted
2. Branch name doesn't match pattern
3. First run (expected)

**Solution:**
```bash
# Check branches in repo
gh api repos/{owner}/{repo}/branches

# Look for branches matching: claude-fix-*
```

### Issue: "PR not updating"

**Symptoms:**
- New commits appear but PR description unchanged
- Old RCA still shown

**Causes:**
1. `gh pr edit` failed
2. Permissions issue

**Solution:**
```bash
# Check workflow logs for:
"♻️  Updating existing PR #..."

# If missing, check GitHub App permissions
```

### Issue: "Force push rejected"

**Symptoms:**
- Push fails with "non-fast-forward" error

**Causes:**
1. Branch protection rules
2. Manual commits on branch

**Solution:**
```bash
# Check branch protection settings
# Ensure bot can force-push

# Or disable force push:
git push origin "$BRANCH_NAME"  # Normal push
```

---

## 📚 Related Files

- `fix-code-production.yml` - Updated workflow with branch reuse
- `schema/apply-rca-editing.sql` - Database migration
- `frontend/app/api/fix/regenerate/route.ts` - Regeneration API
- `RCA_EDITING_FEATURE.md` - Complete RCA editing guide

---

## 🎓 Developer Notes

### Testing Branch Reuse

```bash
# 1. Create initial fix
curl -X POST /api/fix/execute \
  -d '{"repository_id": 123, "problem_statement": "test"}'

# Wait for PR creation

# 2. Trigger regeneration
curl -X POST /api/fix/regenerate \
  -d '{"job_id": "...", "edited_rca": "improved analysis"}'

# 3. Check same branch and PR were updated
gh pr list  # Should see 1 PR, not 2
```

### Monitoring

```bash
# Check workflow logs
# Look for these messages:

# First run:
"🆕 Created new branch: claude-fix-1234567890"

# Regeneration:
"🔄 Regeneration: Looking for existing branch..."
"✅ Found existing branch: claude-fix-1234567890"
"♻️  Reusing branch: claude-fix-1234567890"
"🔄 Force pushing to update existing PR..."
"♻️  Updating existing PR #123..."
"✅ Pull request updated: https://..."
```

---

## 🚀 Future Enhancements

### 1. Pass Branch Name Explicitly

Instead of searching, pass exact branch name:

```typescript
// Store during initial creation
const { branch_name } = result;

// Pass during regeneration
await executeFix({
  branchName: branch_name,  // Exact branch
});
```

### 2. Support Multiple Active Fixes

Track multiple branches per repository:

```sql
ALTER TABLE fix_jobs
ADD COLUMN branch_name VARCHAR(255) UNIQUE;

-- Query specific branch
SELECT * FROM fix_jobs
WHERE repository_id = 123
AND branch_name = 'claude-fix-1234567890';
```

### 3. Branch Cleanup

Auto-delete branches when PR is merged:

```yaml
- name: Cleanup on PR Merge
  if: github.event.pull_request.merged == true
  run: |
    git push origin --delete "$BRANCH_NAME"
```

---

## ✅ Testing Checklist

- [ ] First run creates new branch
- [ ] First run creates new PR
- [ ] Regeneration finds existing branch
- [ ] Regeneration reuses branch (no new branch)
- [ ] Force push updates branch
- [ ] Existing PR is updated (no new PR)
- [ ] PR body shows regeneration note
- [ ] PR timeline shows force-push
- [ ] Multiple regenerations work correctly
- [ ] No duplicate PRs created

---

This update ensures a **clean, organized workflow** where each fix job has **exactly one branch and one PR**, making it easy to track iterations and review changes!
