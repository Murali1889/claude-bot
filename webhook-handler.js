/**
 * GitHub App Webhook Handler
 * Uses Installation Access Tokens (secure, auto-expiring)
 * Integrates with Supabase for API key management
 */

require("dotenv").config();

const { App } = require("@octokit/app");
const { Octokit } = require("@octokit/rest");
const SmeeClient = require("smee-client");
const http = require("http");

// Import our modules
const {
  upsertUser,
  getUserByGitHubId,
  upsertInstallation,
  getInstallation,
  linkUserToInstallation,
  deleteInstallation,
} = require("./lib/supabase");
const {
  retrieveApiKey,
  handleApiKeyFailure,
  checkApiKeyStatus,
  getSetupUrl,
} = require("./lib/api-key-service");

// Validate required environment variables
if (!process.env.APP_ID) {
  console.error("ERROR: APP_ID environment variable is required");
  process.exit(1);
}
if (!process.env.PRIVATE_KEY) {
  console.error("ERROR: PRIVATE_KEY environment variable is required");
  process.exit(1);
}

// Configuration
const CONFIG = {
  APP_ID: parseInt(process.env.APP_ID, 10),
  PRIVATE_KEY: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || "self-healing-claude-secret-2024",
  SMEE_URL: process.env.SMEE_URL,
  WORKER_REPO: process.env.WORKER_REPO || "Murali1889/claude-bot",
  TRIGGER_PHRASE: "@claude",
  SETUP_URL: process.env.SETUP_URL || "https://claude-bot-setup.vercel.app",
  PORT: process.env.PORT || 3000,
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
 */
async function getInstallationToken(installationId) {
  const octokit = await app.getInstallationOctokit(installationId);
  const { token } = await octokit.auth({
    type: "installation",
    installationId: installationId,
  });
  return token;
}

/**
 * Trigger the worker workflow with the installation token and API key
 */
async function triggerWorker(payload, installationToken, anthropicApiKey) {
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

        // The Anthropic API key (encrypted in transit via GitHub)
        anthropic_api_key: anthropicApiKey,

        // Description for Claude
        description: `${payload.issue.title}\n\n${payload.issue.body || ""}`,

        // Who triggered it
        triggered_by: payload.sender.login,
      },
    });

    console.log("Worker workflow triggered successfully!");
    return { success: true };
  } catch (error) {
    console.error("Error triggering workflow:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Handle missing API key - prompt user to set up
 */
async function handleMissingApiKey(octokit, repo, issue, installationId) {
  const setupUrl = getSetupUrl(installationId);

  await octokit.issues.createComment({
    owner: repo.owner.login,
    repo: repo.name,
    issue_number: issue.number,
    body: `## 🔑 API Key Required

To use Claude Bot, you need to configure your Anthropic API key.

**[👉 Click here to set up your API key](${setupUrl})**

### Setup Options:

**Option 1: Anthropic API Key**
1. Get your API key from [console.anthropic.com](https://console.anthropic.com)
2. Click the setup link above and paste your key

**Option 2: Claude Code CLI Token**
1. Install Claude Code: \`npm install -g @anthropic-ai/claude-code\`
2. Run: \`claude setup-token\`
3. Copy the generated token
4. Click the setup link above and paste your token

---
*Your API key is encrypted and stored securely. It's only used to process your requests.*`,
  });
}

/**
 * Handle invalid API key - notify user
 */
async function handleInvalidApiKey(octokit, repo, issue, installationId, error) {
  const setupUrl = getSetupUrl(installationId);

  await octokit.issues.createComment({
    owner: repo.owner.login,
    repo: repo.name,
    issue_number: issue.number,
    body: `## ⚠️ API Key Issue

Your Anthropic API key appears to be invalid or expired.

**Error:** ${error}

**[👉 Click here to update your API key](${setupUrl})**

---
*If you're using a Claude Code token, it may have expired. Run \`claude setup-token\` to generate a new one.*`,
  });
}

// ============================================
// INSTALLATION WEBHOOKS
// ============================================

/**
 * Handle new GitHub App installation
 */
app.webhooks.on("installation.created", async ({ payload }) => {
  const installation = payload.installation;
  const sender = payload.sender;
  const account = installation.account;

  console.log(`\n========================================`);
  console.log(`New installation!`);
  console.log(`Installation ID: ${installation.id}`);
  console.log(`Account: ${account.login} (${account.type})`);
  console.log(`Installed by: ${sender.login}`);
  console.log(`========================================\n`);

  try {
    // Create/update user in database
    const user = await upsertUser(
      sender.id,
      sender.login,
      null, // email not available in webhook
      sender.avatar_url
    );

    console.log(`User stored: ${user.github_username} (ID: ${user.id})`);

    // Create installation record
    const installationRecord = await upsertInstallation(
      installation.id,
      account.login,
      account.type,
      account.id,
      user.id
    );

    console.log(`Installation stored: ${installationRecord.installation_id}`);

    // Log repositories if available
    if (payload.repositories && payload.repositories.length > 0) {
      console.log(`Repositories: ${payload.repositories.map((r) => r.full_name).join(", ")}`);
    }

    console.log(`\nUser should be redirected to: ${getSetupUrl(installation.id)}`);
  } catch (error) {
    console.error("Error handling installation.created:", error);
  }
});

/**
 * Handle GitHub App uninstallation
 */
app.webhooks.on("installation.deleted", async ({ payload }) => {
  const installation = payload.installation;

  console.log(`\n========================================`);
  console.log(`Installation deleted!`);
  console.log(`Installation ID: ${installation.id}`);
  console.log(`Account: ${installation.account.login}`);
  console.log(`========================================\n`);

  try {
    // Delete installation and related API keys
    await deleteInstallation(installation.id);
    console.log(`Installation ${installation.id} deleted from database`);
  } catch (error) {
    console.error("Error handling installation.deleted:", error);
  }
});

/**
 * Handle installation suspension
 */
app.webhooks.on("installation.suspend", async ({ payload }) => {
  console.log(`Installation ${payload.installation.id} suspended`);
});

/**
 * Handle installation unsuspension
 */
app.webhooks.on("installation.unsuspend", async ({ payload }) => {
  console.log(`Installation ${payload.installation.id} unsuspended`);
});

// ============================================
// ISSUE COMMENT HANDLER (with API key check)
// ============================================

app.webhooks.on("issue_comment.created", async ({ payload }) => {
  const comment = payload.comment.body;
  const issue = payload.issue;
  const repo = payload.repository;
  const installationId = payload.installation.id;

  // Check if comment mentions the bot
  if (!comment.toLowerCase().includes(CONFIG.TRIGGER_PHRASE)) {
    return;
  }

  // Ignore if it's a PR comment
  if (payload.issue.pull_request) {
    console.log("Ignoring PR comment");
    return;
  }

  console.log(`\n========================================`);
  console.log(`Trigger detected!`);
  console.log(`Repo: ${repo.full_name}`);
  console.log(`Issue: #${issue.number} - ${issue.title}`);
  console.log(`Installation ID: ${installationId}`);
  console.log(`========================================\n`);

  // Get octokit for this installation
  const octokit = await app.getInstallationOctokit(installationId);

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

  // Check if API key is configured
  console.log("Checking API key configuration...");
  const apiKeyResult = await retrieveApiKey(installationId);

  if (!apiKeyResult.success) {
    console.log(`API key issue: ${apiKeyResult.error}`);

    if (apiKeyResult.error === "NO_API_KEY") {
      await handleMissingApiKey(octokit, repo, issue, installationId);
    } else {
      await handleInvalidApiKey(octokit, repo, issue, installationId, apiKeyResult.message);
    }

    // Add confused reaction
    try {
      await octokit.reactions.createForIssueComment({
        owner: repo.owner.login,
        repo: repo.name,
        comment_id: payload.comment.id,
        content: "confused",
      });
    } catch (e) {
      // Ignore
    }
    return;
  }

  console.log("API key found and decrypted successfully");

  // Get installation token
  console.log("Getting installation token...");
  const installationToken = await getInstallationToken(installationId);
  console.log("Token obtained (expires in 1 hour)");

  // Extract instruction from comment
  const match = comment.match(/@claude\s+([\s\S]*)/i);
  const instruction = match ? match[1].trim() : "fix this issue";
  payload.instruction = instruction;

  // Trigger the worker with API key
  const result = await triggerWorker(payload, installationToken, apiKeyResult.key);

  if (result.success) {
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
    // Check if it's an API key issue
    if (result.error && result.error.includes("401")) {
      // API key authentication failed
      const failureResult = await handleApiKeyFailure(installationId, "Authentication failed");
      await handleInvalidApiKey(octokit, repo, issue, installationId, "API key authentication failed");
    } else {
      await octokit.issues.createComment({
        owner: repo.owner.login,
        repo: repo.name,
        issue_number: issue.number,
        body: `❌ Sorry, I encountered an error while processing this request. Please try again.`,
      });
    }
  }
});

// ============================================
// LABEL TRIGGER HANDLER (with API key check)
// ============================================

app.webhooks.on("issues.labeled", async ({ payload }) => {
  const label = payload.label.name.toLowerCase();
  const installationId = payload.installation.id;
  const repo = payload.repository;
  const issue = payload.issue;

  // Only trigger on specific labels
  if (label !== "claude" && label !== "ai-fix" && label !== "auto-fix") {
    return;
  }

  console.log(`\n========================================`);
  console.log(`Label trigger: ${label}`);
  console.log(`Repo: ${repo.full_name}`);
  console.log(`Issue: #${issue.number}`);
  console.log(`========================================\n`);

  // Get octokit for this installation
  const octokit = await app.getInstallationOctokit(installationId);

  // Check if API key is configured
  const apiKeyResult = await retrieveApiKey(installationId);

  if (!apiKeyResult.success) {
    if (apiKeyResult.error === "NO_API_KEY") {
      await handleMissingApiKey(octokit, repo, issue, installationId);
    } else {
      await handleInvalidApiKey(octokit, repo, issue, installationId, apiKeyResult.message);
    }
    return;
  }

  // Get installation token
  const installationToken = await getInstallationToken(installationId);

  // Trigger worker with API key
  await triggerWorker(payload, installationToken, apiKeyResult.key);
});

// ============================================
// ERROR HANDLING
// ============================================

app.webhooks.onError((error) => {
  console.error("Webhook error:", error.message);
});

// ============================================
// SERVER
// ============================================

async function start() {
  console.log("\n========================================");
  console.log("  Self Healing Claude - Webhook Handler");
  console.log("========================================");
  console.log(`App ID: ${CONFIG.APP_ID}`);
  console.log(`Trigger phrase: ${CONFIG.TRIGGER_PHRASE}`);
  console.log(`Worker repo: ${CONFIG.WORKER_REPO}`);
  console.log(`Smee URL: ${CONFIG.SMEE_URL}`);
  console.log(`Setup URL: ${CONFIG.SETUP_URL}`);
  console.log("========================================\n");

  // Connect to smee.io for local development only
  if (CONFIG.SMEE_URL && process.env.NODE_ENV !== "production") {
    const smee = new SmeeClient({
      source: CONFIG.SMEE_URL,
      target: `http://localhost:${CONFIG.PORT}/webhook`,
      logger: console,
    });
    smee.start();
    console.log("Smee client started for local development");
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
    } else if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
    } else {
      res.writeHead(200);
      res.end("Self Healing Claude is running!");
    }
  });

  server.listen(CONFIG.PORT, () => {
    console.log(`Webhook server listening on port ${CONFIG.PORT}`);
    console.log("\nWaiting for @claude mentions...\n");
  });
}

start();
