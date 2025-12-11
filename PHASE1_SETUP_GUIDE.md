# Phase 1 Setup & Testing Guide

## Completed Implementation

### What's Been Built

1. **Authentication System** ✅
   - GitHub OAuth login/logout
   - Secure session management with httpOnly cookies
   - CSRF protection with state tokens
   - Automatic redirect for logged-in users

2. **Database Schema** ✅
   - Users table with GitHub data
   - Installations table for GitHub App tracking
   - Row Level Security (RLS) policies
   - Proper indexes for performance

3. **Installation Management** ✅
   - Service layer for GitHub API interactions
   - Ownership verification
   - Installation and repository fetching

4. **User Interface** ✅
   - Landing page with login
   - Dashboard with installations and repositories
   - Responsive design with dark mode support
   - Real-time repository fetching

5. **API Endpoints** ✅
   - `GET /api/auth/login` - Initiate OAuth
   - `GET /api/auth/callback` - Handle OAuth callback
   - `GET /api/auth/logout` - Logout user
   - `GET /api/installations` - Get user installations
   - `GET /api/installations/[id]/repositories` - Get repos

## Setup Instructions

### Step 1: Setup Supabase Database

1. **Login to Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/riiisqzwbhlytogcjdmn

2. **Run Database Migrations**

   Navigate to SQL Editor and run these files in order:

   **First**: Run `schema/phase1-auth.sql`
   ```sql
   -- Creates users table with authentication setup
   -- Enables Row Level Security
   -- Adds indexes and triggers
   ```

   **Second**: Run `schema/phase1-installations.sql`
   ```sql
   -- Creates installations table
   -- Creates installation_repositories table
   -- Adds RLS policies and indexes
   ```

3. **Get Supabase Anon Key**
   - Go to: Settings → API
   - Copy the `anon` `public` key (not service_role)
   - Update `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Step 2: Verify Environment Variables

Check `frontend/.env.local` has all these variables:

```bash
# GitHub OAuth (Already configured ✅)
NEXT_PUBLIC_GITHUB_CLIENT_ID=Iv23liSyuHGc6HElALhV
GITHUB_APP_CLIENT_SECRET=9ad6a1d23149f6f459183032b2c77aea3089c10c

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://riiisqzwbhlytogcjdmn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[GET FROM SUPABASE DASHBOARD]  ⚠️ REQUIRED
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... ✅

# Encryption (Already configured ✅)
ENCRYPTION_KEY=a91abab29aa2bdbb6ebece17418e60a5e25b5df13e6b912e1c8011ee39f4f3a7

# GitHub App Configuration (Already configured ✅)
APP_ID=2453803
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."

# App URL (Already configured ✅)
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

### Step 3: Install Dependencies

```bash
cd frontend
npm install
```

New dependencies added:
- `@octokit/app` - GitHub App authentication
- `@octokit/rest` - GitHub REST API client
- `@supabase/ssr` - Supabase server-side rendering
- `@supabase/supabase-js` - Supabase client

### Step 4: Start Development Server

```bash
cd frontend
npm run dev
```

The app will be available at: http://localhost:3001

## Testing Checklist

### 1. Authentication Flow

**Test Login:**
- [ ] Visit http://localhost:3001
- [ ] Click "Sign in with GitHub"
- [ ] You should be redirected to GitHub OAuth
- [ ] Authorize the application
- [ ] You should be redirected to `/dashboard`
- [ ] Check browser cookies (should have `claude_session` and `user_id`)

**Test Auto-Redirect:**
- [ ] While logged in, visit http://localhost:3001
- [ ] You should be automatically redirected to `/dashboard`

**Test Logout:**
- [ ] Click "Logout" in the dashboard header
- [ ] You should be redirected to home page
- [ ] Session cookies should be cleared
- [ ] Verify you can't access `/dashboard` without logging in

**Verify Database:**
```sql
-- Check user was created in Supabase
SELECT * FROM users ORDER BY created_at DESC LIMIT 1;
```

### 2. GitHub App Installation

**Test Installation:**
- [ ] Login to dashboard
- [ ] Click "Install GitHub App" button
- [ ] Select repositories (or choose "All repositories")
- [ ] Complete installation
- [ ] You should be redirected back to dashboard
- [ ] Installation should appear in the list

**Important**: Currently, the installation webhook is NOT set up yet.
This means installations won't be automatically saved to the database.
This will be implemented in the webhook handler (separate from frontend).

For now, you can manually verify installations are fetched from GitHub:
- The dashboard uses `getUserInstallations()` which queries GitHub API directly
- No database storage required for Phase 1 testing

### 3. Repository Display

**Test Repository Fetching:**
- [ ] After installing the app, your installation should appear in dashboard
- [ ] Click on the installation to expand it
- [ ] Repositories should load automatically
- [ ] Each repository should show:
  - Repository name
  - Private/Public badge
  - Description (if available)
  - Programming language
  - Link to GitHub (click to verify)

**Test Multiple Installations:**
- [ ] Install the app on another account/organization (if available)
- [ ] Dashboard should show both installations
- [ ] Each should have its own repository list
- [ ] Verify you can only see your own installations

### 4. Security Testing

**Test Unauthorized Access:**
```bash
# Try accessing dashboard without login
curl http://localhost:3001/dashboard
# Should redirect to home page

# Try accessing API without session
curl http://localhost:3001/api/installations
# Should return 401 Unauthorized
```

**Test Session Security:**
- [ ] Inspect session cookies in browser DevTools
- [ ] Verify `httpOnly` flag is set (prevents XSS)
- [ ] Verify `sameSite` is set to `lax` (CSRF protection)
- [ ] In production, verify `secure` flag is set (HTTPS only)

**Test Installation Ownership:**
- [ ] Try accessing another user's installation (if you know the ID)
- [ ] Should return 403 Forbidden
- [ ] The service verifies ownership before returning data

### 5. Error Handling

**Test Network Errors:**
- [ ] Turn off internet connection
- [ ] Try fetching installations
- [ ] Should show error message with retry button
- [ ] Click retry - should attempt to fetch again

**Test Invalid Installation ID:**
```bash
curl http://localhost:3001/api/installations/999999/repositories
# Should return 403 or 404
```

**Test GitHub API Errors:**
- [ ] Temporarily change APP_ID to invalid value
- [ ] Restart server
- [ ] Try loading dashboard
- [ ] Should show user-friendly error message

## Common Issues & Solutions

### Issue: "GitHub OAuth not configured"

**Solution:**
```bash
# Verify these are set in .env.local
NEXT_PUBLIC_GITHUB_CLIENT_ID=Iv23liSyuHGc6HElALhV
GITHUB_APP_CLIENT_SECRET=9ad6a1d23149f6f459183032b2c77aea3089c10c
```

### Issue: "Failed to fetch installations"

**Solution:**
1. Check GitHub App credentials are correct
2. Verify APP_ID and PRIVATE_KEY in `.env.local`
3. Make sure GitHub App is installed on your account
4. Check browser console for detailed errors

### Issue: "Unauthorized" when accessing API

**Solution:**
1. Make sure you're logged in (check cookies)
2. Clear cookies and try logging in again
3. Check session is created properly in `/api/auth/callback`

### Issue: Database connection errors

**Solution:**
1. Verify Supabase URL and keys are correct
2. Check Supabase project is active (not paused)
3. Run database migrations (phase1-auth.sql, phase1-installations.sql)
4. Make sure SUPABASE_SERVICE_KEY is set (for server-side operations)

### Issue: "Invalid state" during OAuth

**Solution:**
1. Clear browser cookies
2. Try login flow again
3. This error indicates CSRF token mismatch
4. Make sure cookies are enabled in your browser

### Issue: Repositories not showing

**Solution:**
1. Check the installation actually has repositories
2. Verify GitHub App has repository access permission
3. Check browser console for API errors
4. Try re-installing the GitHub App

## Database Verification Queries

Run these in Supabase SQL Editor to verify everything is working:

```sql
-- Check users table
SELECT * FROM users ORDER BY created_at DESC;

-- Check installations table (will be empty until webhook is set up)
SELECT * FROM installations ORDER BY created_at DESC;

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'installations');

-- Check indexes exist
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('users', 'installations');
```

## Next Steps (Phase 2)

After Phase 1 is working:

1. **Backend Webhook Handler**
   - Create webhook endpoint to receive GitHub events
   - Handle `installation.created`, `installation.deleted`
   - Store installations in Supabase database
   - Link installations to users

2. **API Key Management**
   - Add API key input page
   - Implement encryption before storage
   - Validate API keys with Anthropic
   - Display API key status on dashboard

3. **Workflow Integration**
   - Update GitHub Actions workflow
   - Pass API key from database to workflow
   - Handle @claude mentions in issues
   - Create automated PRs with fixes

## Security Checklist

Before deploying to production:

- [ ] Change `NEXT_PUBLIC_APP_URL` to production URL
- [ ] Update GitHub App callback URL to production
- [ ] Rotate `ENCRYPTION_KEY` to a new random value
- [ ] Enable HTTPS (cookies will use `secure` flag automatically)
- [ ] Review and enable Supabase RLS policies
- [ ] Set up rate limiting for API endpoints
- [ ] Add CORS configuration for production
- [ ] Review and update CSP headers
- [ ] Set up monitoring and error tracking (e.g., Sentry)
- [ ] Configure backup strategy for Supabase

## File Structure Reference

```
frontend/
├── app/
│   ├── page.tsx                    # ✅ Landing page with login
│   ├── layout.tsx                  # ✅ Root layout
│   ├── dashboard/
│   │   ├── page.tsx               # ✅ Dashboard (server component)
│   │   └── DashboardClient.tsx    # ✅ Client-side logic
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts     # ✅ OAuth initiation
│       │   ├── callback/route.ts  # ✅ OAuth callback
│       │   └── logout/route.ts    # ✅ Logout
│       └── installations/
│           ├── route.ts                        # ✅ Get installations
│           └── [id]/repositories/route.ts      # ✅ Get repositories
├── lib/
│   ├── auth.ts                    # ✅ Auth helpers
│   ├── supabase.ts                # ✅ Supabase client
│   ├── encryption.ts              # ✅ Encryption utilities
│   └── installation-service.ts    # ✅ GitHub App service
└── schema/
    ├── phase1-auth.sql            # ✅ Users table
    └── phase1-installations.sql   # ✅ Installations table
```

## API Documentation

### GET /api/auth/login
Initiates GitHub OAuth flow.

**Security**: Generates CSRF state token.

**Response**: Redirects to GitHub.

---

### GET /api/auth/callback?code=xxx&state=xxx
Handles OAuth callback.

**Security**: Verifies state token, creates session.

**Response**: Redirects to `/dashboard`.

---

### GET /api/auth/logout
Destroys session and logs out user.

**Security**: Clears all session cookies.

**Response**: Redirects to home.

---

### GET /api/installations
Get user's GitHub App installations.

**Authentication**: Required (session cookie).

**Security**: Only returns installations owned by authenticated user.

**Response**:
```json
{
  "installations": [
    {
      "id": 12345,
      "account": {
        "login": "username",
        "type": "User",
        "avatar_url": "https://...",
        "id": 67890
      },
      "repository_selection": "all",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "suspended_at": null
    }
  ]
}
```

---

### GET /api/installations/[id]/repositories
Get repositories for a specific installation.

**Authentication**: Required (session cookie).

**Security**: Verifies user owns the installation.

**Parameters**: `id` - Installation ID

**Response**:
```json
{
  "repositories": [
    {
      "id": 123,
      "name": "my-repo",
      "full_name": "username/my-repo",
      "private": false,
      "html_url": "https://github.com/username/my-repo",
      "description": "My awesome repository",
      "language": "TypeScript",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## Support

If you encounter issues:

1. Check browser console for errors
2. Check server logs (terminal where `npm run dev` is running)
3. Verify all environment variables are set correctly
4. Check Supabase logs in the dashboard
5. Review this guide's troubleshooting section

## Success Criteria

Phase 1 is complete when:

- ✅ Users can login with GitHub
- ✅ Users are stored in Supabase database
- ✅ Dashboard displays user information
- ✅ GitHub App installations are fetched and displayed
- ✅ Repositories are shown for each installation
- ✅ Users can only see their own data
- ✅ Sessions are secure (httpOnly, sameSite)
- ✅ Logout works properly
- ✅ All security checks pass

Congratulations! You're ready for Phase 2: API Key Management. 🎉
