# HyperHeal Orchestrator

Auto-healing system that connects Freshdesk tickets to GitHub fixes via Claude AI.

## Flow

```
Freshdesk Ticket → Orchestrator → GitHub Issue + @claude → Claude Bot → PR → Slack → Approve → Merge
     (auto)           (auto)              (auto)            (auto)    (auto)  (human)   (auto)
```

## Setup Guide

### Step 1: Create GitHub Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes:
   - `repo` (full control)
4. Copy the token (starts with `ghp_`)

### Step 2: Create Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name: `HyperHeal`
4. Select your workspace

**Add Bot Permissions:**
1. Go to "OAuth & Permissions"
2. Under "Bot Token Scopes", add:
   - `chat:write`
   - `chat:write.public`
   - `channels:read`

**Enable Interactivity:**
1. Go to "Interactivity & Shortcuts"
2. Turn ON
3. Request URL: `https://your-server.com/slack/interactions`

**Install to Workspace:**
1. Go to "Install App"
2. Click "Install to Workspace"
3. Copy the "Bot User OAuth Token" (starts with `xoxb-`)

**Get Signing Secret:**
1. Go to "Basic Information"
2. Copy "Signing Secret"

### Step 3: Get Slack Channel ID

1. In Slack, right-click on the channel you want notifications in
2. Click "View channel details"
3. Scroll down to find "Channel ID" (starts with `C`)

### Step 4: Configure the Orchestrator

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your values:
   ```
   GITHUB_TOKEN=ghp_xxxx
   SLACK_BOT_TOKEN=xoxb-xxxx
   SLACK_SIGNING_SECRET=xxxx
   ```

3. Update `config.js` with your repo mapping:
   ```javascript
   productMapping: {
     'Your Product Name': {
       owner: 'your-github-org',
       repo: 'your-repo-name',
       slackChannel: 'C0123456789',
     }
   }
   ```

### Step 5: Deploy the Orchestrator

**Option A: Local Testing with ngrok**
```bash
# Terminal 1
npm install
npm start

# Terminal 2
ngrok http 3000
```

**Option B: Deploy to Railway**
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

**Option C: Deploy to Render/Vercel/Fly.io**
- Follow their respective deployment guides

### Step 6: Configure Freshdesk Webhook

1. Go to Freshdesk Admin → Automations → Ticket Creation
2. Create new rule:

```
Rule Name: HyperHeal Auto-Trigger

WHEN:
  Ticket is Created
  AND Type is "Bug"

ACTIONS:
  Trigger Webhook
    - Method: POST
    - URL: https://your-orchestrator-url.com/webhooks/freshdesk
    - Content Type: JSON
    - Body:
```

```json
{
  "ticket_id": "{{ticket.id}}",
  "subject": "{{ticket.subject}}",
  "description": "{{ticket.description_text}}",
  "requester_email": "{{ticket.requester.email}}",
  "requester_name": "{{ticket.requester.name}}",
  "priority": "{{ticket.priority}}",
  "product": "{{ticket.product.name}}",
  "tags": "{{ticket.tags}}"
}
```

### Step 7: Configure GitHub Webhook

1. Go to your GitHub repo → Settings → Webhooks → Add webhook
2. Configure:
   - Payload URL: `https://your-orchestrator-url.com/webhooks/github`
   - Content type: `application/json`
   - Events: Select "Pull requests"
3. Save

### Step 8: Install Claude Bot on Your Repo

Make sure the [claude-bot](../claude-bot) GitHub App is installed on your target repository.

## Testing

1. Create a test ticket in Freshdesk with Type = "Bug"
2. Watch the logs:
   ```bash
   npm start
   ```
3. You should see:
   - GitHub issue created
   - @claude triggered
   - (After Claude Bot runs) Slack notification with RCA
4. Click "Approve & Merge" in Slack
5. PR gets merged!

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/webhooks/freshdesk` | POST | Receives Freshdesk ticket webhooks |
| `/webhooks/github` | POST | Receives GitHub PR webhooks |
| `/slack/interactions` | POST | Handles Slack button clicks |

## Troubleshooting

**No Slack notification appearing?**
- Check that the GitHub webhook is configured correctly
- Verify the PR title contains `[Auto-Heal]` or `Freshdesk #`
- Check orchestrator logs for errors

**Merge failing?**
- Ensure GitHub token has `repo` permissions
- Check if branch protection rules are blocking

**Freshdesk webhook not triggering?**
- Verify the automation rule conditions match your ticket
- Check Freshdesk automation logs
