/**
 * GitHub App Webhook Handler
 * Uses Installation Access Tokens (secure, auto-expiring)
 */

const { App } = require("@octokit/app");
const { Octokit } = require("@octokit/rest");
const SmeeClient = require("smee-client");
const http = require("http");

// Configuration - UPDATE THESE
const CONFIG = {
  // Get these from your GitHub App settings page
  APP_ID: process.env.APP_ID || "YOUR_APP_ID",
  PRIVATE_KEY: process.env.PRIVATE_KEY || `-----BEGIN RSA PRIVATE KEY-----
YOUR_PRIVATE_KEY_HERE
-----END RSA PRIVATE KEY-----`,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || "self-healing-claude-secret-2024",

  // Smee URL for local development
  SMEE_URL: process.env.SMEE_URL || "https://smee.io/hvqA4xWSJEikpQuc",

  // Your worker repo
  WORKER_REPO: process.env.WORKER_REPO || "Murali1889/claude-bot",

  // Trigger phrase
  TRIGGER_PHRASE: "@claude",
};

// Initialize GitHub App
const app = new App({
  appId: CONFIG.APP_ID,
  privateKey: CONFIG.PRIVATE_KEY,
  webhooks: {
    secret: CONFIG.WEBHOOK_SECRET,
  },
});

/**
 * Get installation access token for a specific installation
 * This token is scoped to only the repos the user granted access to
 * Token expires in 1 hour (secure!)
 */
async function getInstallationToken(installationId) {
  const octokit = await app.getInstallationOctokit(installationId);

  // Get the token
  const { token } = await octokit.auth({
    type: "installation",
    installationId: installationId,
  });

  return token;
}

/**
 * Trigger the worker workflow with the installation token
 */
async function triggerWorker(payload, installationToken) {
  // Use a separate octokit for triggering (needs access to worker repo)
  // For now, we'll include the token in the payload
  const octokit = await app.getInstallationOctokit(payload.installation.id);

  try {
    await octokit.repos.createDispatchEvent({
      owner: CONFIG.WORKER_REPO.split("/")[0],
      repo: CONFIG.WORKER_REPO.split("/")[1],
      event_type: "claude-fix",
      client_payload: {
        // Repository info
        repo: payload.repository.full_name,
        repo_owner: payload.repository.owner.login,
        repo_name: payload.repository.name,

        // Issue info
        issue_number: payload.issue.number,
        issue_title: payload.issue.title,
        issue_body: payload.issue.body || "",

        // The installation token (expires in 1 hour)
        installation_token: installationToken,

        // Description for Claude
        description: `${payload.issue.title}\n\n${payload.issue.body || ""}`,

        // Who triggered it
        triggered_by: payload.sender.login,
      },
    });

    console.log("Worker workflow triggered successfully!");
    return true;
  } catch (error) {
    console.error("Error triggering workflow:", error.message);
    return false;
  }
}

// Handle issue comments
app.webhooks.on("issue_comment.created", async ({ payload }) => {
  const comment = payload.comment.body;
  const issue = payload.issue;
  const repo = payload.repository;

  // Check if comment mentions the bot
  if (!comment.toLowerCase().includes(CONFIG.TRIGGER_PHRASE)) {
    return;
  }

  // Ignore if it's a PR comment (not an issue)
  if (payload.issue.pull_request) {
    console.log("Ignoring PR comment");
    return;
  }

  console.log(`\n========================================`);
  console.log(`Trigger detected!`);
  console.log(`Repo: ${repo.full_name}`);
  console.log(`Issue: #${issue.number} - ${issue.title}`);
  console.log(`Installation ID: ${payload.installation.id}`);
  console.log(`========================================\n`);

  // Extract instruction from comment
  const match = comment.match(/@claude\s+([\s\S]*)/i);
  const instruction = match ? match[1].trim() : "fix this issue";

  // Get installation-specific token
  console.log("Getting installation token...");
  const installationToken = await getInstallationToken(payload.installation.id);
  console.log("Token obtained (expires in 1 hour)");

  // Get octokit for this installation
  const octokit = await app.getInstallationOctokit(payload.installation.id);

  // React to show we received it
  try {
    await octokit.reactions.createForIssueComment({
      owner: repo.owner.login,
      repo: repo.name,
      comment_id: payload.comment.id,
      content: "eyes",
    });
  } catch (e) {
    console.log("Could not add reaction:", e.message);
  }

  // Update payload with instruction
  payload.instruction = instruction;

  // Trigger the worker
  const success = await triggerWorker(payload, installationToken);

  if (success) {
    // Add rocket reaction
    try {
      await octokit.reactions.createForIssueComment({
        owner: repo.owner.login,
        repo: repo.name,
        comment_id: payload.comment.id,
        content: "rocket",
      });
    } catch (e) {
      console.log("Could not add rocket reaction:", e.message);
    }
  } else {
    // Comment about error
    await octokit.issues.createComment({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: issue.number,
      body: `❌ Sorry, I encountered an error while processing this request. Please try again.`,
    });
  }
});

// Handle issues with label
app.webhooks.on("issues.labeled", async ({ payload }) => {
  const label = payload.label.name.toLowerCase();

  // Only trigger on specific labels
  if (label !== "claude" && label !== "ai-fix" && label !== "auto-fix") {
    return;
  }

  console.log(`\n========================================`);
  console.log(`Label trigger: ${label}`);
  console.log(`Repo: ${payload.repository.full_name}`);
  console.log(`Issue: #${payload.issue.number}`);
  console.log(`========================================\n`);

  // Get installation token
  const installationToken = await getInstallationToken(payload.installation.id);

  // Trigger worker
  await triggerWorker(payload, installationToken);
});

// Error handling
app.webhooks.onError((error) => {
  console.error("Webhook error:", error.message);
});

// Start the server
async function start() {
  console.log("\n========================================");
  console.log("  Self Healing Claude - Webhook Handler");
  console.log("========================================");
  console.log(`App ID: ${CONFIG.APP_ID}`);
  console.log(`Trigger phrase: ${CONFIG.TRIGGER_PHRASE}`);
  console.log(`Worker repo: ${CONFIG.WORKER_REPO}`);
  console.log(`Smee URL: ${CONFIG.SMEE_URL}`);
  console.log("========================================\n");

  // Connect to smee.io for local development
  if (CONFIG.SMEE_URL && CONFIG.SMEE_URL !== "YOUR_SMEE_URL") {
    const smee = new SmeeClient({
      source: CONFIG.SMEE_URL,
      target: "http://localhost:3000/webhook",
      logger: console,
    });
    smee.start();
  }

  // HTTP server to receive webhooks
  const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/webhook") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          await app.webhooks.verifyAndReceive({
            id: req.headers["x-github-delivery"],
            name: req.headers["x-github-event"],
            signature: req.headers["x-hub-signature-256"],
            payload: body,
          });
          res.writeHead(200);
          res.end("OK");
        } catch (error) {
          console.error("Webhook verification error:", error.message);
          res.writeHead(400);
          res.end("Error");
        }
      });
    } else {
      res.writeHead(200);
      res.end("Self Healing Claude is running!");
    }
  });

  server.listen(3000, () => {
    console.log("Webhook server listening on http://localhost:3000");
    console.log("\nWaiting for @claude mentions...\n");
  });
}

start();
