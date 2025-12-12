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

interface ExecuteFixParams {
  jobId: string;
  installationId: number;
  repositoryFullName: string;
  problemStatement: string;
  complexity?: string;
  encryptedKey: string;
  keyIv: string;
  keyAuthTag: string;
  userRca?: string;
  regeneration?: boolean;
  imageUrls?: string[];
  screenshotsBase64?: string[];
}

/**
 * Execute fix by triggering worker workflow
 * Takes all needed data as parameters to avoid database queries
 */
export async function executeFix(params: ExecuteFixParams): Promise<void> {
  const { jobId, installationId, repositoryFullName, problemStatement, complexity, encryptedKey, keyIv, keyAuthTag, userRca, regeneration, imageUrls, screenshotsBase64 } = params;

  console.log(`[executeFix] Starting for job ${jobId}`);
  console.log(`[executeFix] Repository: ${repositoryFullName}`);
  console.log(`[executeFix] Installation: ${installationId}`);

  const supabase = createServerClient();

  try {
    // Decrypt token
    console.log(`[executeFix] Decrypting API key...`);
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      console.error(`[executeFix] ENCRYPTION_KEY not set`);
      throw new Error("Encryption key not configured");
    }

    const token = decrypt(
      encryptedKey,
      keyIv,
      keyAuthTag,
      encryptionKey
    );
    console.log(`[executeFix] Token decrypted successfully`);

    // Trigger worker workflow FIRST
    console.log(`[executeFix] Triggering worker workflow...`);
    await triggerWorkerWorkflow(
      installationId,
      repositoryFullName,
      problemStatement,
      token,
      jobId,
      complexity || 'medium',
      userRca,
      regeneration,
      imageUrls,
      screenshotsBase64
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
  jobId: string,
  complexity: string = 'medium',
  userRca?: string,
  regeneration?: boolean,
  imageUrls?: string[],
  screenshotsBase64?: string[]
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

  // Use the workflow file (fix-code.yml in worker repo)
  const workflowFile = 'fix-code.yml';
  const workflowUrl = `https://api.github.com/repos/${workerOwner}/${workerRepo}/actions/workflows/${workflowFile}/dispatches`;
  console.log(`[triggerWorkflow] Worker repo: ${workerOwner}/${workerRepo}`);
  console.log(`[triggerWorkflow] Workflow URL: ${workflowUrl}`);
  console.log(`[triggerWorkflow] Target repo: ${targetRepo}`);
  console.log(`[triggerWorkflow] Installation ID: ${installationId}`);
  console.log(`[triggerWorkflow] Regeneration: ${regeneration || false}`);

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

  // Trigger workflow_dispatch using fetch with timeout and retry
  console.log(`[triggerWorkflow] Making POST request to GitHub API...`);
  console.log(`[triggerWorkflow] URL: ${workflowUrl}`);

  const maxRetries = 3;
  const timeoutMs = 60000; // 60 seconds
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[triggerWorkflow] Attempt ${attempt}/${maxRetries}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      console.log(`[triggerWorkflow] Sending request with body...`);
      console.log(`[triggerWorkflow] Using PAT: ${githubToken.substring(0, 15)}... (length: ${githubToken.length})`);

      response = await fetch(workflowUrl, {
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
            complexity: complexity,
            user_rca: userRca || '',
            regeneration: regeneration ? 'true' : 'false',
            image_urls: imageUrls ? imageUrls.join(',') : '',
            screenshots_base64: screenshotsBase64 ? JSON.stringify(screenshotsBase64) : '[]',
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log(`[triggerWorkflow] ✅ Response received: ${response.status} ${response.statusText}`);

      // Log response headers for debugging
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      const rateLimitReset = response.headers.get('x-ratelimit-reset');
      console.log(`[triggerWorkflow] Rate limit remaining: ${rateLimitRemaining}`);
      if (rateLimitRemaining === '0' && rateLimitReset) {
        const resetDate = new Date(parseInt(rateLimitReset) * 1000);
        console.log(`[triggerWorkflow] ⚠️ Rate limit will reset at: ${resetDate.toISOString()}`);
      }

      // If response is OK, break out of retry loop
      if (response.ok) {
        console.log(`[triggerWorkflow] ✅ Successfully triggered workflow in ${workerOwner}/${workerRepo} for ${targetRepo}`);
        return; // Success - exit function
      }

      // If not OK, handle error and potentially retry
      lastError = new Error(`GitHub API returned ${response.status}`);

    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error(`[triggerWorkflow] ❌ Request timeout after ${timeoutMs/1000}s (attempt ${attempt}/${maxRetries})`);
        lastError = new Error(`GitHub API request timeout after ${timeoutMs/1000}s`);
      } else {
        console.error(`[triggerWorkflow] ❌ Fetch error (attempt ${attempt}/${maxRetries}):`, fetchError);
        console.error(`[triggerWorkflow] Error details:`, {
          name: fetchError instanceof Error ? fetchError.name : 'Unknown',
          message: fetchError instanceof Error ? fetchError.message : String(fetchError),
        });
        lastError = fetchError instanceof Error ? fetchError : new Error('Unknown fetch error');
      }
    }

    // If this wasn't the last attempt, wait before retrying (exponential backoff)
    if (attempt < maxRetries) {
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s wait
      console.log(`[triggerWorkflow] ⏳ Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // If we got here, all retries failed
  console.error(`[triggerWorkflow] ❌ All ${maxRetries} attempts failed`);
  throw new Error(`Failed to trigger workflow after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}
