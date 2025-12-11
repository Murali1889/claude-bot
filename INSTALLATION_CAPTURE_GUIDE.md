# Installation Capture (Without Webhooks)

## Overview

Instead of relying on webhooks, we now **capture installations immediately** when GitHub redirects the user after installation. This is:

✅ **Faster** - No waiting for webhook delivery
✅ **More Reliable** - No webhook delivery failures
✅ **Better UX** - User sees installation immediately
✅ **Secure** - User must be authenticated to link installation

## How It Works

```
User clicks "Install GitHub App"
         ↓
GitHub App installation page
         ↓
User selects repositories & installs
         ↓
GitHub redirects to: /setup?installation_id=XXX&setup_action=install
         ↓
User must login (if not already)
         ↓
Frontend calls: POST /api/installations/capture
         ↓
Backend:
  1. Verifies user is authenticated
  2. Fetches installation from GitHub API
  3. Verifies user owns the installation
  4. Stores in Supabase database
         ↓
User can proceed to configure API key
```

## GitHub App Configuration

### Update Setup URL

1. Go to your GitHub App settings:
   - **Production**: `https://github.com/settings/apps/YOUR_APP_NAME`
   - **Development**: `https://github.com/settings/apps/YOUR_APP_NAME`

2. Find **"Setup URL (optional)"** section

3. Update to your deployment URL:
   - **Production**: `https://claude-bot.vercel.app/setup`
   - **Development**: `http://localhost:3001/setup`

4. ✅ Check **"Redirect on update"**
   - This ensures users are redirected here when they update installation settings too

5. Click **"Save changes"**

## What Gets Captured

When a user installs the app, we capture:

- `installation_id` - Unique GitHub installation ID
- `account_login` - GitHub username or org name
- `account_type` - "User" or "Organization"
- `account_id` - GitHub account ID
- `repository_selection` - "all" or "selected"
- `user_id` - Linked to authenticated user in our database

## Security Features

### 1. Authentication Required
```typescript
// User must be logged in
const user = await getSessionUser();
if (!user) {
  return 401 Unauthorized
}
```

### 2. Ownership Verification
```typescript
// Fetch from GitHub to verify
const installation = await github.getInstallation(installation_id);

// Verify authenticated user owns it
if (installation.account.id !== user.github_user_id) {
  return 403 Forbidden
}
```

### 3. Database Linkage
```sql
-- Installation is linked to user
INSERT INTO installations (
  installation_id,
  user_id,  -- Links to authenticated user
  ...
)
```

## Testing Flow

### Step 1: Update GitHub App Setup URL

```bash
# For local testing
Setup URL: http://localhost:3001/setup
✅ Redirect on update

# For production
Setup URL: https://claude-bot.vercel.app/setup
✅ Redirect on update
```

### Step 2: Test Installation

1. **Login to your app**
   ```
   Visit: http://localhost:3001
   Click: "Sign in with GitHub"
   Complete OAuth flow
   ```

2. **Install GitHub App**
   ```
   Click: "Install GitHub App" on dashboard
   Or visit: https://github.com/apps/YOUR_APP/installations/new
   ```

3. **Select Repositories**
   - Choose "All repositories" or "Select repositories"
   - Select repositories you want to enable
   - Click "Install"

4. **GitHub Redirects**
   ```
   You'll be redirected to:
   http://localhost:3001/setup?installation_id=99147876&setup_action=install
   ```

5. **Installation Captured**
   - Frontend calls `/api/installations/capture`
   - Backend stores installation in database
   - Linked to your user account
   - Check browser console for confirmation:
     ```
     Installation captured successfully: {
       id: 99147876,
       account_login: "your-username",
       ...
     }
     ```

### Step 3: Verify in Database

Run this query in Supabase SQL Editor:

```sql
-- Check installation was stored
SELECT
  i.installation_id,
  i.account_login,
  i.account_type,
  u.github_username,
  i.created_at
FROM installations i
JOIN users u ON i.user_id = u.id
ORDER BY i.created_at DESC
LIMIT 5;
```

You should see your installation!

### Step 4: View in Dashboard

```
Visit: http://localhost:3001/dashboard
```

Your installation should now appear in the list with all repositories.

## API Endpoint Details

### POST /api/installations/capture

**Purpose**: Capture installation from GitHub redirect

**Authentication**: Required (session cookie)

**Request**:
```json
{
  "installation_id": "99147876",
  "setup_action": "install"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Installation captured successfully",
  "installation": {
    "id": 99147876,
    "account_login": "your-username",
    "account_type": "User",
    "repository_selection": "all"
  }
}
```

**Response (Unauthorized)**:
```json
{
  "error": "Unauthorized - Please login first"
}
```

**Response (Forbidden)**:
```json
{
  "error": "Forbidden",
  "message": "You do not own this installation. Please login with the correct GitHub account."
}
```

**Response (Not Found)**:
```json
{
  "error": "Installation not found on GitHub",
  "details": "The installation may have been deleted or you may not have access to it"
}
```

## Error Handling

### Case 1: User Not Logged In

```
User arrives at: /setup?installation_id=XXX
         ↓
Redirect to: /api/auth/login
         ↓
GitHub OAuth
         ↓
Redirect back to: /setup?installation_id=XXX
         ↓
Now authenticated → capture installation
```

### Case 2: Wrong User Logged In

```
Installation owned by: userA
Currently logged in as: userB
         ↓
API returns: 403 Forbidden
         ↓
User sees error: "Please login with the correct GitHub account"
         ↓
User can logout and login with correct account
```

### Case 3: Installation Deleted

```
Installation doesn't exist on GitHub
         ↓
API returns: 404 Not Found
         ↓
User sees error: "Installation not found on GitHub"
         ↓
User can reinstall the app
```

### Case 4: Capture Fails Silently

```
If /api/installations/capture fails:
  1. Error logged to console
  2. User not notified (don't break UX)
  3. Webhook will capture it later (fallback)
  4. Or user can manually trigger via dashboard
```

## Advantages Over Webhooks

| Feature | Webhook Approach | Capture Approach |
|---------|-----------------|------------------|
| **Speed** | Delayed (seconds to minutes) | Immediate |
| **Reliability** | Can fail, need retries | Direct API call |
| **User Context** | No user session | User is authenticated |
| **Delivery** | Push (can be lost) | Pull (guaranteed) |
| **Debugging** | Hard to debug webhook issues | Easy to debug in browser |
| **User Feedback** | Silent, user doesn't know status | Immediate confirmation |

## Combined Approach (Best of Both)

You can use **both** methods for maximum reliability:

1. **Primary**: Capture on redirect (instant, user-initiated)
2. **Fallback**: Webhook handler (catches missed installations)

This ensures:
- ✅ Installations are captured immediately when user installs
- ✅ Missed installations are caught by webhook
- ✅ Updates to installations are also captured
- ✅ User always sees accurate data

## Common Issues

### Issue: "Missing installation_id parameter"

**Cause**: GitHub didn't redirect with installation_id

**Solution**:
1. Check GitHub App setup URL is correct
2. Verify "Redirect on update" is checked
3. Try reinstalling the app

### Issue: "Unauthorized - Please login first"

**Cause**: User not authenticated when arriving at /setup

**Solution**:
1. User will be redirected to login automatically
2. After login, they'll return to /setup with installation_id
3. Installation will be captured

### Issue: "You do not own this installation"

**Cause**: Logged in user doesn't own the installation

**Solution**:
1. Logout
2. Login with the correct GitHub account that owns the installation
3. Installation will be linked to correct user

### Issue: Installation not showing in dashboard

**Cause**: Database query might be using database data instead of GitHub API

**Solution**:
1. Check `getUserInstallations()` in `lib/installation-service.ts`
2. Make sure it's fetching from GitHub API, not database
3. Or update to query both sources

## Next Steps

After installation is captured:

1. ✅ User sees their installation in dashboard
2. ⏭️ User configures API key (already in /setup page)
3. ⏭️ User can start using @claude in issues
4. ⏭️ Backend webhook receives issue comments
5. ⏭️ Workflow triggers with user's API key

## Production Deployment

When deploying to production (Vercel):

1. **Update GitHub App Setup URL**:
   ```
   https://claude-bot.vercel.app/setup
   ```

2. **Update Callback URL** (if using OAuth):
   ```
   https://claude-bot.vercel.app/api/auth/callback
   ```

3. **Environment Variables on Vercel**:
   - All `.env.local` variables
   - Make sure `NEXT_PUBLIC_APP_URL` = `https://claude-bot.vercel.app`

4. **Verify in Production**:
   - Install app on a test repository
   - Should redirect to production setup URL
   - Installation should be captured
   - Verify in Supabase

## Summary

✅ **No webhook needed** for installation tracking
✅ **Immediate capture** when user installs
✅ **Secure** - user must be authenticated
✅ **Reliable** - direct API call
✅ **Better UX** - instant feedback

The installation is now stored in your Supabase database and linked to the authenticated user!
