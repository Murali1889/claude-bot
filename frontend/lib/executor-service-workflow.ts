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
  const supabase = createServerClient();

  try {
    // Update job status to 'running'
    await supabase
      .from("fix_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from("fix_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      throw new Error("Job not found");
    }

    // Get Claude token (decrypted)
    const { data: apiKey, error: keyError } = await supabase
      .from("api_keys")
      .select("*")
      .eq("installation_id", job.installation_id)
      .single();

    if (keyError || !apiKey) {
      throw new Error("Claude token not found");
    }

    // Decrypt token
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("Encryption key not configured");
    }

    const token = decrypt(
      apiKey.encrypted_key,
      apiKey.key_iv,
      apiKey.key_auth_tag,
      encryptionKey
    );

    // Trigger worker workflow
    await triggerWorkerWorkflow(
      job.installation_id,
      job.repository_full_name,
      job.problem_statement,
      token,
      jobId
    );

    console.log(`Worker workflow triggered for job ${jobId}`);

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
  // Use Personal Access Token to trigger workflow in our own repository
  const githubToken = process.env.GITHUB_PAT;

  if (!githubToken) {
    throw new Error(
      "GITHUB_PAT not configured. Create a PAT at https://github.com/settings/tokens"
    );
  }

  // Worker repository details
  const workerOwner = process.env.WORKER_REPO_OWNER || "Muralivvrsn";
  const workerRepo = process.env.WORKER_REPO_NAME || "claude-bot-worker";

  // Trigger workflow_dispatch using fetch (simpler than Octokit for this)
  const response = await fetch(
    `https://api.github.com/repos/${workerOwner}/${workerRepo}/actions/workflows/fix-code.yml/dispatches`,
    {
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
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to trigger workflow: ${response.status} ${error}`
    );
  }

  console.log(
    `Triggered workflow in ${workerOwner}/${workerRepo} for ${targetRepo}`
  );
}
