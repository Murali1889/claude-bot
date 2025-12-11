/**
 * Executor Service - Worker Workflow Approach
 * Triggers a workflow in our worker repository to fix code
 *
 * This approach:
 * - Uses a separate worker repository with the workflow
 * - Workflow runs Claude CLI in GitHub Actions
 * - Creates PR to user's repository
 * - User's repository stays clean (no workflow files)
 */

import { createServerClient } from "./supabase";
import { decrypt } from "./encryption";
import { App } from "@octokit/app";

/**
 * Execute fix by triggering worker workflow
 */
export async function executeFix(jobId: string): Promise<void> {
  console.log(`[executeFix] Starting for job ${jobId}`);
  const supabase = createServerClient();

  try {
    // Get job details first (while status is still 'pending')
    console.log(`[executeFix] Fetching job details`);
    const { data: job, error: jobError } = await supabase
      .from("fix_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error(`[executeFix] Job not found:`, jobError);
      throw new Error("Job not found");
    }
    console.log(`[executeFix] Job found:`, {
      installation_id: job.installation_id,
      repository: job.repository_full_name,
      problem: job.problem_statement.substring(0, 50) + '...'
    });

    // Get Claude token (decrypted)
    console.log(`[executeFix] Fetching API key for installation ${job.installation_id}`);
    const { data: apiKey, error: keyError } = await supabase
      .from("api_keys")
      .select("*")
      .eq("installation_id", job.installation_id)
      .single();

    if (keyError || !apiKey) {
      console.error(`[executeFix] Claude token not found:`, keyError);
      throw new Error("Claude token not found");
    }
    console.log(`[executeFix] API key found, decrypting...`);

    // Decrypt token
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      console.error(`[executeFix] ENCRYPTION_KEY not set`);
      throw new Error("Encryption key not configured");
    }

    const token = decrypt(
      apiKey.encrypted_key,
      apiKey.key_iv,
      apiKey.key_auth_tag,
      encryptionKey
    );
    console.log(`[executeFix] Token decrypted successfully`);

    // Trigger worker workflow FIRST
    console.log(`[executeFix] Triggering worker workflow...`);
    await triggerWorkerWorkflow(
      job.installation_id,
      job.repository_full_name,
      job.problem_statement,
      token,
      jobId
    );

    console.log(`[executeFix] ✅ Worker workflow triggered successfully for job ${jobId}`);

    // Update job status to 'running' AFTER workflow is successfully triggered
    console.log(`[executeFix] Updating job status to running`);
    await supabase
      .from("fix_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    console.log(`[executeFix] Job status updated to running`);

    // Job will be updated by webhook when workflow completes
  } catch (error) {
    console.error(`Error executing fix job ${jobId}:`, error);

    // Update job as failed
    await supabase
      .from("fix_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message:
          error instanceof Error ? error.message : "Unknown error occurred",
      })
      .eq("id", jobId);

    throw error;
  }
}

/**
 * Trigger the worker workflow in our repository
 */
async function triggerWorkerWorkflow(
  installationId: number,
  targetRepo: string,
  problemStatement: string,
  apiKey: string,
  jobId: string
): Promise<void> {
  console.log(`[triggerWorkflow] Starting workflow trigger for job ${jobId}`);

  // Use Personal Access Token to trigger workflow in our own repository
  const githubToken = process.env.GITHUB_PAT;

  if (!githubToken) {
    console.error(`[triggerWorkflow] GITHUB_PAT not configured`);
    throw new Error(
      "GITHUB_PAT not configured. Create a PAT at https://github.com/settings/tokens"
    );
  }
  console.log(`[triggerWorkflow] GITHUB_PAT found: ${githubToken.substring(0, 10)}...`);

  // Worker repository details
  const workerOwner = process.env.WORKER_REPO_OWNER || "Muralivvrsn";
  const workerRepo = process.env.WORKER_REPO_NAME || "claude-bot-worker";

  const workflowUrl = `https://api.github.com/repos/${workerOwner}/${workerRepo}/actions/workflows/fix-code.yml/dispatches`;
  console.log(`[triggerWorkflow] Worker repo: ${workerOwner}/${workerRepo}`);
  console.log(`[triggerWorkflow] Workflow URL: ${workflowUrl}`);
  console.log(`[triggerWorkflow] Target repo: ${targetRepo}`);
  console.log(`[triggerWorkflow] Installation ID: ${installationId}`);

  const requestBody = {
    ref: "main",
    inputs: {
      target_repo: targetRepo,
      problem_statement: problemStatement,
      installation_id: installationId.toString(),
      job_id: jobId,
      api_key: apiKey.substring(0, 20) + "...",
    },
  };
  console.log(`[triggerWorkflow] Request body:`, JSON.stringify(requestBody, null, 2));

  // Trigger workflow_dispatch using fetch (simpler than Octokit for this)
  console.log(`[triggerWorkflow] Making POST request to GitHub API...`);
  const response = await fetch(workflowUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: "main",
      inputs: {
        target_repo: targetRepo,
        problem_statement: problemStatement,
        installation_id: installationId.toString(),
        job_id: jobId,
        api_key: apiKey,
      },
    }),
  });

  console.log(`[triggerWorkflow] Response status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const error = await response.text();
    console.error(`[triggerWorkflow] ❌ Failed to trigger workflow:`, error);
    throw new Error(
      `Failed to trigger workflow: ${response.status} ${error}`
    );
  }

  console.log(
    `[triggerWorkflow] ✅ Successfully triggered workflow in ${workerOwner}/${workerRepo} for ${targetRepo}`
  );
}
