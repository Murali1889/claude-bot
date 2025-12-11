/**
 * HyperHeal Configuration
 *
 * Maps Freshdesk products/tags to GitHub repos and Slack channels
 * Customize this based on your setup
 */

module.exports = {
  // Freshdesk domain
  freshdeskDomain: 'hyperverge-help.freshdesk.com',

  // Map Freshdesk product names to GitHub repos and Slack channels
  // The key should match what comes from Freshdesk (product name or tag)
  productMapping: {
    // Default - all tickets go to HyperCPQ repo
    'default': {
      owner: 'zaid-k-m',              // GitHub username/org
      repo: 'HyperCPQ',               // GitHub repo name
      slackChannel: 'SLACK_CHANNEL_ID', // Will update after Slack setup
    }
  },

  // Freshdesk priority mapping (Freshdesk uses numbers)
  priorityLabels: {
    1: { label: 'Urgent', emoji: '🔴' },
    2: { label: 'High', emoji: '🟠' },
    3: { label: 'Medium', emoji: '🟡' },
    4: { label: 'Low', emoji: '🟢' }
  },

  // GitHub labels to add to auto-created issues
  githubLabels: ['auto-heal', 'bug', 'freshdesk'],

  // Claude prompt template
  claudePrompt: (ticket) => `@claude Analyze and fix this bug automatically.

## Bug Report
**Title:** ${ticket.subject}
**Priority:** ${ticket.priority}
**Reported by:** ${ticket.requester_name}

## Description
${ticket.description}

## Instructions
1. Analyze the codebase to identify the root cause
2. Implement a fix in a new branch
3. Create a Draft PR with your changes
4. In the PR description, include a JSON block with this exact format:

\`\`\`json
{
  "root_cause": "Detailed explanation of what caused this bug",
  "fix_summary": "What changes were made to fix it",
  "files_changed": [
    {"file": "path/to/file.js", "reason": "Why this file was changed"}
  ],
  "risk_level": "low|medium|high",
  "risk_explanation": "Why this risk level",
  "test_recommendations": [
    "How to test this fix"
  ]
}
\`\`\`

---
*HyperHeal Auto-Trigger | Freshdesk #${ticket.ticket_id}*`
};
