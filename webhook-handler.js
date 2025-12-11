/**
 * GitHub App Webhook Handler
 *
 * This runs locally during development using smee.io
 * For production, deploy to Cloudflare Workers or Vercel
 */

const { Webhooks } = require("@octokit/webhooks");
const { Octokit } = require("@octokit/rest");
const SmeeClient = require("smee-client");

// Configuration
const CONFIG = {
  SMEE_URL: process.env.SMEE_URL || "https://smee.io/hvqA4xWSJEikpQuc",
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || "self-healing-claude-secret-2024",
  GITHUB_TOKEN: process.env.BOT_GITHUB_TOKEN,
  WORKER_REPO: process.env.WORKER_REPO || "Murali1889/claude-bot",
  TRIGGER_PHRASE: "@claude", // What users type to trigger the bot
};

// Initialize
const webhooks = new Webhooks({ secret: CONFIG.WEBHOOK_SECRET });
const octokit = new Octokit({ auth: CONFIG.GITHUB_TOKEN });

// Handle issue comments
webhooks.on("issue_comment.created", async ({ payload }) => {
  const comment = payload.comment.body;
  const issue = payload.issue;
  const repo = payload.repository;

  // Check if comment mentions the bot
  if (!comment.toLowerCase().includes(CONFIG.TRIGGER_PHRASE)) {
    console.log("Comment doesn't contain trigger phrase, skipping");
    return;
  }

  console.log(`\n========================================`);
  console.log(`Trigger detected!`);
  console.log(`Repo: ${repo.full_name}`);
  console.log(`Issue: #${issue.number} - ${issue.title}`);
  console.log(`Comment: ${comment}`);
  console.log(`========================================\n`);

  // Extract instruction from comment (everything after @claude)
  const match = comment.match(/@claude\s+([\s\S]*)/i);
  const instruction = match ? match[1].trim() : "fix this issue";

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

  // Trigger the worker workflow
  try {
    console.log("Triggering worker workflow...");

    await octokit.repos.createDispatchEvent({
      owner: CONFIG.WORKER_REPO.split("/")[0],
      repo: CONFIG.WORKER_REPO.split("/")[1],
      event_type: "claude-fix",
      client_payload: {
        repo: repo.full_name,
        issue_number: issue.number,
        issue_title: issue.title,
        issue_body: issue.body || "",
        description: `${issue.title}\n\n${issue.body || ""}\n\nInstruction: ${instruction}`,
        file_hint: "", // Could parse from comment if needed
        triggered_by: payload.comment.user.login,
      },
    });

    console.log("Worker workflow triggered successfully!");

    // Add rocket reaction to show it's being processed
    await octokit.reactions.createForIssueComment({
      owner: repo.owner.login,
      repo: repo.name,
      comment_id: payload.comment.id,
      content: "rocket",
    });
  } catch (error) {
    console.error("Error triggering workflow:", error.message);

    // Comment on issue about the error
    await octokit.issues.createComment({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: issue.number,
      body: `❌ Sorry, I encountered an error while processing this request.\n\nError: ${error.message}`,
    });
  }
});

// Handle new issues with label
webhooks.on("issues.labeled", async ({ payload }) => {
  const label = payload.label.name;
  const issue = payload.issue;
  const repo = payload.repository;

  // Trigger on specific label (e.g., "claude" or "ai-fix")
  if (label !== "claude" && label !== "ai-fix") {
    return;
  }

  console.log(`\n========================================`);
  console.log(`Label trigger: ${label}`);
  console.log(`Repo: ${repo.full_name}`);
  console.log(`Issue: #${issue.number}`);
  console.log(`========================================\n`);

  // Trigger worker
  try {
    await octokit.repos.createDispatchEvent({
      owner: CONFIG.WORKER_REPO.split("/")[0],
      repo: CONFIG.WORKER_REPO.split("/")[1],
      event_type: "claude-fix",
      client_payload: {
        repo: repo.full_name,
        issue_number: issue.number,
        issue_title: issue.title,
        issue_body: issue.body || "",
        description: `${issue.title}\n\n${issue.body || ""}`,
        file_hint: "",
        triggered_by: "label",
      },
    });

    console.log("Worker triggered via label!");
  } catch (error) {
    console.error("Error:", error.message);
  }
});

// Start the webhook receiver
async function start() {
  console.log("\n========================================");
  console.log("  Claude Bot Webhook Handler");
  console.log("========================================");
  console.log(`Trigger phrase: ${CONFIG.TRIGGER_PHRASE}`);
  console.log(`Worker repo: ${CONFIG.WORKER_REPO}`);
  console.log(`Smee URL: ${CONFIG.SMEE_URL}`);
  console.log("========================================\n");

  // Connect to smee.io for local development
  const smee = new SmeeClient({
    source: CONFIG.SMEE_URL,
    target: "http://localhost:3000/webhook",
    logger: console,
  });

  smee.start();

  // Simple HTTP server to receive webhooks
  const http = require("http");
  const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/webhook") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const signature = req.headers["x-hub-signature-256"];
          await webhooks.verifyAndReceive({
            id: req.headers["x-github-delivery"],
            name: req.headers["x-github-event"],
            signature,
            payload: body,
          });
          res.writeHead(200);
          res.end("OK");
        } catch (error) {
          console.error("Webhook error:", error.message);
          res.writeHead(400);
          res.end("Error");
        }
      });
    } else {
      res.writeHead(200);
      res.end("Claude Bot is running!");
    }
  });

  server.listen(3000, () => {
    console.log("Webhook server listening on http://localhost:3000");
    console.log("\nWaiting for events...\n");
  });
}

start();
