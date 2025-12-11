/**
 * HyperHeal Orchestrator (Simplified - No Slack)
 *
 * Receives Freshdesk webhooks and triggers Claude bot on GitHub
 * Flow: Freshdesk Ticket → GitHub Issue → @claude comment
 */

require('dotenv').config();
const express = require('express');
const { Octokit } = require('@octokit/rest');
const config = require('./config');

// Initialize Express
const app = express();
app.use(express.json());

// Initialize GitHub client
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// In-memory store for tracking (use a database in production)
const ticketStore = new Map();

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'hyperheal-orchestrator' });
});

app.get('/', (req, res) => {
  res.json({
    message: 'HyperHeal Orchestrator is running!',
    endpoints: {
      health: 'GET /health',
      freshdesk: 'POST /webhooks/freshdesk'
    }
  });
});

// ============================================
// FRESHDESK WEBHOOK - Auto-trigger on ticket creation
// ============================================
app.post('/webhooks/freshdesk', async (req, res) => {
  console.log('\n========================================');
  console.log('📩 Received Freshdesk webhook');
  console.log('========================================');
  console.log('Payload:', JSON.stringify(req.body, null, 2));

  const ticket = req.body;

  // Validate required fields
  if (!ticket.ticket_id || !ticket.subject) {
    console.log('❌ Missing required fields');
    return res.status(400).json({ error: 'Missing ticket_id or subject' });
  }

  // Get mapping based on product or use default
  const mapping = config.productMapping[ticket.product] || config.productMapping['default'];

  if (!mapping) {
    console.log('❌ No mapping found and no default configured');
    return res.status(400).json({ error: 'No repo mapping found' });
  }

  const { owner, repo } = mapping;

  try {
    // ----------------------------------------
    // 1. Create GitHub Issue
    // ----------------------------------------
    console.log(`\n📝 Creating GitHub issue in ${owner}/${repo}...`);

    const priorityInfo = config.priorityLabels[ticket.priority] || config.priorityLabels[3];

    const issue = await octokit.issues.create({
      owner,
      repo,
      title: `[Freshdesk #${ticket.ticket_id}] ${ticket.subject}`,
      body: formatIssueBody(ticket, priorityInfo),
      labels: config.githubLabels
    });

    console.log(`✅ Created issue #${issue.data.number}`);
    console.log(`   URL: ${issue.data.html_url}`);

    // ----------------------------------------
    // 2. Trigger @claude by commenting
    // ----------------------------------------
    console.log(`\n🤖 Triggering @claude on issue #${issue.data.number}...`);

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issue.data.number,
      body: config.claudePrompt(ticket)
    });

    console.log('✅ @claude triggered!');

    // ----------------------------------------
    // 3. Store tracking info
    // ----------------------------------------
    ticketStore.set(ticket.ticket_id, {
      freshdesk_id: ticket.ticket_id,
      github_issue_number: issue.data.number,
      github_issue_url: issue.data.html_url,
      owner,
      repo,
      status: 'processing',
      created_at: new Date().toISOString()
    });

    // ----------------------------------------
    // 4. Send response
    // ----------------------------------------
    console.log('\n========================================');
    console.log('✅ AUTO-HEAL TRIGGERED SUCCESSFULLY!');
    console.log('========================================');
    console.log(`Freshdesk Ticket: #${ticket.ticket_id}`);
    console.log(`GitHub Issue: ${issue.data.html_url}`);
    console.log('========================================\n');

    res.json({
      success: true,
      message: 'Auto-heal triggered',
      freshdesk_ticket: ticket.ticket_id,
      github_issue: issue.data.html_url,
      github_issue_number: issue.data.number
    });

  } catch (error) {
    console.error('\n❌ Error processing ticket:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TEST ENDPOINT - Manually test the flow
// ============================================
app.post('/test', async (req, res) => {
  console.log('\n🧪 Test endpoint called');

  // Simulate a Freshdesk ticket
  const testTicket = {
    ticket_id: 'TEST-' + Date.now(),
    subject: 'Test Bug - Button not working',
    description: 'This is a test ticket to verify the auto-heal flow is working correctly.',
    requester_email: 'test@example.com',
    requester_name: 'Test User',
    priority: 2,
    product: null,
    tags: 'test, auto-heal'
  };

  // Forward to the main handler
  req.body = testTicket;

  // Call the freshdesk handler logic
  const mapping = config.productMapping['default'];
  const { owner, repo } = mapping;

  try {
    const priorityInfo = config.priorityLabels[testTicket.priority];

    const issue = await octokit.issues.create({
      owner,
      repo,
      title: `[TEST] ${testTicket.subject}`,
      body: formatIssueBody(testTicket, priorityInfo),
      labels: ['test', 'auto-heal']
    });

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issue.data.number,
      body: config.claudePrompt(testTicket)
    });

    res.json({
      success: true,
      message: 'Test issue created!',
      github_issue: issue.data.html_url
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatIssueBody(ticket, priorityInfo) {
  return `## Bug Report from Freshdesk

**Ticket ID:** #${ticket.ticket_id}
**Reported by:** ${ticket.requester_name || 'Unknown'} (${ticket.requester_email || 'No email'})
**Priority:** ${priorityInfo.emoji} ${priorityInfo.label}

---

### Description

${ticket.description || 'No description provided'}

---

### Tags
${ticket.tags || 'None'}

---
*Auto-generated by HyperHeal*`;
}

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
========================================
🚀 HyperHeal Orchestrator
========================================

Server running on port ${PORT}

Endpoints:
  GET  /                    - Info
  GET  /health              - Health check
  POST /webhooks/freshdesk  - Freshdesk webhook
  POST /test                - Test endpoint

Target Repository: ${config.productMapping['default'].owner}/${config.productMapping['default'].repo}

Ready to auto-heal! 🔧
========================================
  `);
});
