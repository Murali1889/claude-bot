# Setup Guide: User Authentication & API Key Management

This guide walks you through setting up the new API key management system for Claude Bot.

## What's New

Users no longer need to add `ANTHROPIC_API_KEY` to their repository secrets. Instead:

1. **User installs GitHub App** → Webhook stores user in database
2. **GitHub redirects to setup page** → User authenticates via GitHub OAuth
3. **User enters API key** → Key is validated and encrypted
4. **User triggers @claude** → Webhook fetches key from database

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  GitHub     │────►│  Webhook    │────►│  Supabase   │
│  App        │     │  Handler    │     │  Database   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│  Vercel     │     │  GitHub     │
│  Frontend   │     │  Actions    │
└─────────────┘     └─────────────┘
```

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to **SQL Editor**
3. Copy the contents of `schema/supabase.sql` and run it
4. Go to **Settings → API** and copy:
   - Project URL (`SUPABASE_URL`)
   - Service role key (`SUPABASE_SERVICE_KEY`)

## Step 2: Generate Encryption Key

Run this command to generate a secure encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save this key - you'll use it in both the backend and frontend.

## Step 3: Update GitHub App Settings

In your GitHub App settings:

1. **Setup URL**: Set to your Vercel frontend URL
   ```
   https://your-app.vercel.app/setup
   ```

2. **Redirect on update**: Check this box

3. **Request user authorization (OAuth)**: Enable this

4. **Callback URL**: Add
   ```
   https://your-app.vercel.app/setup
   ```

5. Copy your **Client ID** and generate a **Client Secret**

## Step 4: Configure Backend (Webhook Handler)

Update your `.env` file:

```bash
# Existing
APP_ID=your_app_id
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
WEBHOOK_SECRET=your_webhook_secret
SMEE_URL=https://smee.io/your_channel
WORKER_REPO=username/claude-bot

# New - Add these
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
ENCRYPTION_KEY=your-64-char-hex-key
SETUP_URL=https://your-app.vercel.app
```

Install new dependencies:

```bash
npm install
```

## Step 5: Deploy Frontend to Vercel

1. Create a new directory for the frontend or use the `frontend/` folder
2. Push to a separate GitHub repo (or deploy from this repo's `frontend/` folder)
3. Connect to Vercel and add environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
ENCRYPTION_KEY=your-64-char-hex-key  # Same as backend!
GITHUB_APP_CLIENT_ID=Iv1.xxxxx
GITHUB_APP_CLIENT_SECRET=xxxxx
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_GITHUB_CLIENT_ID=Iv1.xxxxx  # Same as GITHUB_APP_CLIENT_ID
```

4. Deploy!

## Step 6: Update Worker Repository Secrets

In your worker repository (`WORKER_REPO`):

1. Go to **Settings → Secrets and variables → Actions**
2. **Remove** the `ANTHROPIC_API_KEY` secret (no longer needed!)
3. The workflow now receives the API key from the webhook payload

## Testing the Setup

### Test 1: Installation Webhook

1. Install the GitHub App on a test repository
2. Check webhook handler logs - you should see:
   ```
   New installation!
   Installation ID: 12345
   User stored: your_username
   ```

### Test 2: Setup Page

1. After installation, go to:
   ```
   https://your-app.vercel.app/setup?installation_id=12345
   ```
2. Sign in with GitHub
3. Enter your Anthropic API key
4. Should show "Setup Complete!"

### Test 3: Trigger @claude

1. Create an issue in the installed repository
2. Comment: `@claude fix this`
3. Should see:
   - Eyes reaction (received)
   - Rocket reaction (processing)
   - Comment with PR link

### Test 4: Missing API Key

1. Remove the API key from database (or use new installation)
2. Comment: `@claude fix this`
3. Should see a comment prompting to set up API key

## File Structure

```
claude-bot/
├── webhook-handler.js          # Updated with Supabase integration
├── package.json                # Added @supabase/supabase-js, @sendgrid/mail
├── .env                        # Add new variables
├── lib/
│   ├── encryption.js           # AES-256-GCM encryption
│   ├── supabase.js             # Database operations
│   └── api-key-service.js      # API key management
├── schema/
│   └── supabase.sql            # Database schema
├── .github/
│   └── workflows/
│       └── worker.yml          # Uses API key from payload
└── frontend/                   # Vercel frontend
    ├── app/
    │   ├── page.tsx            # Landing page
    │   ├── setup/page.tsx      # API key setup form
    │   └── api/                # API routes
    ├── lib/
    │   ├── supabase.ts
    │   └── encryption.ts
    └── package.json
```

## Security Notes

1. **Encryption**: API keys are encrypted with AES-256-GCM before storage
2. **Authentication**: Users must verify GitHub identity via OAuth
3. **Authorization**: Users can only access their own installations
4. **Key Prefix**: Only first 15 characters stored for identification
5. **Transit**: API key passes through GitHub's encrypted dispatch payload

## Troubleshooting

### "Installation not found"
- Check that the installation webhook was received
- Verify Supabase connection is working

### "You don't own this installation"
- User must be the one who installed the app
- For org installations, user must be a member

### "Invalid API key"
- Check key starts with `sk-ant-`
- Verify key in Anthropic Console is active

### API key not being used in workflow
- Check worker.yml is updated to use `client_payload.anthropic_api_key`
- Verify webhook handler is passing the key

## Next Steps

1. Set up alerts (SendGrid for email, Slack webhooks)
2. Add dashboard for users to manage their keys
3. Implement key rotation reminders
4. Add usage analytics
