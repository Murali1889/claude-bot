# Phase 1: Authentication & GitHub App Installation Flow

## Overview
Implement secure user authentication with GitHub OAuth, GitHub App installation tracking, and repository display.

## User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   USER JOURNEY                               │
└─────────────────────────────────────────────────────────────┘

1. User visits homepage (/)
   ↓
2. Clicks "Login with GitHub"
   ↓
3. Redirected to GitHub OAuth
   ↓
4. User authorizes application
   ↓
5. Callback creates/updates user in Supabase
   ↓
6. User redirected to /dashboard
   ↓
7. Dashboard shows:
   - User profile
   - "Install GitHub App" button (if not installed)
   - List of installations (if installed)
   - Repositories for each installation
   ↓
8. User clicks "Install GitHub App"
   ↓
9. Redirected to GitHub App installation
   ↓
10. User selects repositories and installs
    ↓
11. GitHub webhook fires (installation.created)
    ↓
12. Backend stores installation in Supabase
    ↓
13. User redirected back to /dashboard
    ↓
14. Dashboard now shows installed repositories
```

## Security Features

### 1. **CSRF Protection**
- State parameter in OAuth flow
- CSRF tokens for state-changing operations
- SameSite cookie attributes

### 2. **Session Security**
- HttpOnly cookies (prevent XSS)
- Secure flag in production (HTTPS only)
- SameSite=lax for CSRF protection
- 7-day expiration with automatic cleanup

### 3. **Data Encryption**
- API keys encrypted with AES-256-GCM
- Unique IV per encryption
- Authentication tags prevent tampering
- Master key stored only in environment variables

### 4. **Input Validation**
- All user inputs sanitized
- GitHub webhook signatures verified
- Installation ownership verified before showing repos

### 5. **Access Control**
- Users can only see their own installations
- Installation ownership verified via GitHub API
- Row Level Security (RLS) on Supabase

## Database Schema (Already Created)

```sql
-- users table (from phase1-auth.sql)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_user_id BIGINT UNIQUE NOT NULL,
    github_username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- installations table (to be added)
CREATE TABLE installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id BIGINT UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_login VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    account_id BIGINT NOT NULL,
    suspended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Components to Implement

### 1. Frontend Components

#### a. Home Page (`app/page.tsx`) ✅ EXISTS
- **Current**: Static landing page
- **Update**: Add proper login button linking to `/api/auth/login`
- **Security**: No sensitive data on public page

#### b. Dashboard Page (`app/dashboard/page.tsx`) ⚠️ TO CREATE
- **Purpose**: Main user interface after authentication
- **Features**:
  - User profile display (avatar, username)
  - Logout button
  - GitHub App installation status
  - List of installations with repositories
- **Security**:
  - Server-side authentication check
  - Only shows user's own data

#### c. Components Directory
- `components/UserProfile.tsx` - Display user info
- `components/InstallationCard.tsx` - Show installation details
- `components/RepositoryList.tsx` - List repos per installation

### 2. API Routes

#### a. Authentication (✅ COMPLETE)
- `GET /api/auth/login` - Initiate OAuth
- `GET /api/auth/callback` - Handle OAuth callback
- `GET /api/auth/session` - Get current user session
- `POST /api/auth/logout` - Destroy session

#### b. Installations (⚠️ TO CREATE)
- `GET /api/installations` - List user's GitHub app installations
  - Fetches from GitHub API
  - Returns installations user owns

- `GET /api/installations/:id/repos` - Get repos for installation
  - Verifies user owns installation
  - Returns repository list

#### c. Webhook Handler (Backend - ⚠️ TO CREATE)
- `POST /webhook` - Handle GitHub webhooks
  - `installation.created` - Store new installation
  - `installation.deleted` - Remove installation
  - `installation.suspend` - Mark as suspended
  - Verify webhook signature

### 3. Backend Services

#### a. Installation Service (`lib/installation-service.ts`)
```typescript
- getInstallationsForUser(userId: string)
- getRepositories(installationId: number)
- verifyInstallationOwnership(installationId: number, userId: string)
- storeInstallation(data)
- removeInstallation(installationId)
```

## Implementation Steps

### Step 1: Update Database Schema ✅
- Run phase1-auth.sql in Supabase (already done)
- Add installations table from supabase.sql

### Step 2: Create Dashboard Page
- Server-side auth check
- Fetch user installations from GitHub API
- Display user profile and installations
- Show repository list per installation

### Step 3: Create API Endpoints
- `/api/installations` - Get user's GitHub installations
- `/api/installations/[id]/repos` - Get repos for installation

### Step 4: Update Home Page
- Add "Login with GitHub" button
- Improve UI/UX for logged-in users
- Redirect to dashboard if already logged in

### Step 5: Backend Webhook Handler
- Create Express endpoint to handle installation webhooks
- Verify GitHub webhook signatures
- Store installation data in Supabase
- Link installations to users

### Step 6: GitHub App Configuration
- Set installation setup URL: `http://localhost:3001/dashboard`
- Enable webhook events:
  - installation.created
  - installation.deleted
  - installation.suspend
  - installation.unsuspend

## Environment Variables Checklist

```bash
# Frontend (.env.local) ✅
NEXT_PUBLIC_GITHUB_CLIENT_ID=Iv23liSyuHGc6HElALhV
GITHUB_APP_CLIENT_SECRET=9ad6a1d23149f6f459183032b2c77aea3089c10c
NEXT_PUBLIC_SUPABASE_URL=https://riiisqzwbhlytogcjdmn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[needed]
SUPABASE_SERVICE_KEY=eyJhbGc...
ENCRYPTION_KEY=a91abab29aa2...
APP_ID=2453803
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Backend (webhook-handler.js) - TO ADD
SUPABASE_URL=https://riiisqzwbhlytogcjdmn.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
GITHUB_WEBHOOK_SECRET=[from GitHub App settings]
```

## API Endpoints Specification

### GET /api/installations

**Purpose**: Fetch all GitHub App installations for authenticated user

**Authentication**: Required (session cookie)

**Response**:
```json
{
  "installations": [
    {
      "id": 12345678,
      "account": {
        "login": "username",
        "type": "User",
        "avatar_url": "https://..."
      },
      "created_at": "2024-01-01T00:00:00Z",
      "suspended_at": null,
      "repository_selection": "all"
    }
  ]
}
```

**Security**:
- Verify user session
- Only return installations user owns
- Use GitHub App JWT for authentication with GitHub API

### GET /api/installations/[id]/repos

**Purpose**: Get repositories for a specific installation

**Authentication**: Required (session cookie)

**Parameters**:
- `id` - Installation ID

**Response**:
```json
{
  "repositories": [
    {
      "id": 123,
      "name": "my-repo",
      "full_name": "username/my-repo",
      "private": false,
      "html_url": "https://github.com/username/my-repo"
    }
  ]
}
```

**Security**:
- Verify user owns this installation
- Use installation access token from GitHub
- Return 403 if user doesn't own installation

## Testing Checklist

### Authentication Flow
- [ ] User can click login and be redirected to GitHub
- [ ] OAuth callback creates user in database
- [ ] Session cookie is set correctly
- [ ] User is redirected to dashboard after login
- [ ] Logout destroys session properly
- [ ] CSRF state token prevents replay attacks

### Installation Flow
- [ ] Dashboard shows "Install GitHub App" button
- [ ] User can install app on repositories
- [ ] Webhook captures installation.created event
- [ ] Installation is stored in database with correct user_id
- [ ] Dashboard updates to show installed repos
- [ ] User can only see their own installations

### Security Testing
- [ ] Session cookies are httpOnly
- [ ] Session cookies are secure in production
- [ ] CSRF tokens prevent forged requests
- [ ] User A cannot access User B's installations
- [ ] Webhook signatures are verified
- [ ] Invalid OAuth state is rejected

## Error Handling

### OAuth Errors
- Missing code → Redirect to home with error message
- Invalid state → Redirect to home with error message
- Token exchange fails → Log error, show user-friendly message

### API Errors
- Unauthorized → Return 401 with clear message
- Installation not found → Return 404
- GitHub API errors → Return 502 with retry suggestion

### Webhook Errors
- Invalid signature → Return 401, log attempt
- Missing data → Return 400, log payload
- Database errors → Return 500, retry with exponential backoff

## Next Steps (Phase 2)

After Phase 1 is complete:
1. Add API key management (encrypt and store)
2. Create setup page for API key input
3. Implement API key validation with Anthropic
4. Update webhook handler to trigger workflows with API key
5. Add notification system for API key failures

## References

- GitHub OAuth: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps
- GitHub Apps: https://docs.github.com/en/apps/creating-github-apps
- Supabase Auth: https://supabase.com/docs/guides/auth
- Next.js Auth Patterns: https://nextjs.org/docs/authentication
