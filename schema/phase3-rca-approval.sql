-- Phase 3: RCA Approval and Workflow Enhancement
-- Adds RCA review/approval flow and PR tracking

-- Add RCA approval fields to fix_jobs table
ALTER TABLE fix_jobs
ADD COLUMN IF NOT EXISTS rca_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rca_edited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS user_edited_rca TEXT,
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS workflow_run_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS existing_pr_checked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reused_codebase_doc BOOLEAN DEFAULT FALSE;

-- Add indexes for approval workflow
CREATE INDEX IF NOT EXISTS idx_fix_jobs_rca_approved ON fix_jobs(rca_approved);
CREATE INDEX IF NOT EXISTS idx_fix_jobs_requires_approval ON fix_jobs(requires_approval);

-- Add comments
COMMENT ON COLUMN fix_jobs.rca_approved IS 'Whether the user has approved the RCA';
COMMENT ON COLUMN fix_jobs.rca_edited IS 'Whether the user edited the RCA';
COMMENT ON COLUMN fix_jobs.user_edited_rca IS 'User-edited version of the RCA';
COMMENT ON COLUMN fix_jobs.requires_approval IS 'Whether this job requires RCA approval before code changes';
COMMENT ON COLUMN fix_jobs.workflow_run_id IS 'GitHub Actions workflow run ID';
COMMENT ON COLUMN fix_jobs.existing_pr_checked IS 'Whether we checked for existing PRs';
COMMENT ON COLUMN fix_jobs.reused_codebase_doc IS 'Whether code_base.md was reused from existing PR';

-- New status values for the approval flow:
-- 'rca_pending_approval' - RCA generated, waiting for user approval
-- 'rca_approved' - User approved RCA, ready for code changes
-- 'rca_rejected' - User rejected RCA, needs regeneration

COMMENT ON COLUMN fix_jobs.status IS 'Job status: pending, rca_started, rca_completed, rca_pending_approval, rca_approved, rca_rejected, code_changes_started, code_changes_completed, pr_created, completed, failed';
