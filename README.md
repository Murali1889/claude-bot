# Claude Bot

A GitHub App that automatically fixes code issues using Claude AI.

## How It Works

```
User comments "@claude fix this"
        ↓
GitHub sends webhook to your app
        ↓
App triggers worker workflow
        ↓
Worker clones repo, runs Claude, creates PR
        ↓
Bot comments with PR link
```

## Setup

### 1. Create GitHub App

Go to: https://github.com/settings/apps/new

**Settings:**
- Name: `claude-code-fixer` (or your choice)
- Homepage URL: `https://github.com/YOUR_USERNAME`
- Webhook URL: Your smee.io URL (see step 2)
- Webhook secret: Generate a random string

**Permissions:**
- Contents: Read & Write
- Issues: Read & Write
- Pull requests: Read & Write
- Metadata: Read-only

**Events:**
- Issue comment
- Issues

### 2. Create Smee Channel

Go to: https://smee.io/new

Copy the URL (e.g., `https://smee.io/abc123xyz`)

### 3. Create Personal Access Token

Go to: https://github.com/settings/tokens/new

**Scopes needed:**
- `repo` (full control of private repositories)

Save the token as `BOT_GITHUB_TOKEN`

### 4. Push This Repo to GitHub

```bash
cd ~/claude-bot
git init
git add .
git commit -m "Initial commit"
gh repo create claude-bot --public --source=. --push
```

### 5. Add Secrets to Worker Repo

Go to: https://github.com/YOUR_USERNAME/claude-bot/settings/secrets/actions

Add these secrets:
- `ANTHROPIC_API_KEY`: Your Anthropic API key
- `BOT_GITHUB_TOKEN`: The PAT from step 3

### 6. Configure webhook-handler.js

Update the CONFIG section:
```javascript
const CONFIG = {
  SMEE_URL: "https://smee.io/YOUR_CHANNEL",
  WEBHOOK_SECRET: "your-webhook-secret",
  WORKER_REPO: "YOUR_USERNAME/claude-bot",
};
```

### 7. Install Dependencies & Run

```bash
npm install
npm start
```

### 8. Install the GitHub App

Go to: https://github.com/settings/apps/YOUR_APP_NAME/installations

Click "Install" and select the repos you want to use it on.

## Usage

In any issue on an installed repo:

```
@claude fix this bug
```

```
@claude implement this feature
```

```
@claude refactor the login component
```

Or add the `claude` label to an issue.

## Production Deployment

For production, deploy the webhook handler to:
- **Cloudflare Workers** (free)
- **Vercel Serverless** (free)
- **Railway** (free tier)

The worker workflow runs on GitHub Actions (free).

## Files

```
claude-bot/
├── .github/
│   └── workflows/
│       └── worker.yml      # Does the actual work
├── webhook-handler.js      # Receives webhooks, triggers worker
├── package.json
└── README.md
```

## License

MIT
