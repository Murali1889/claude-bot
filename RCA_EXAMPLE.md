# RCA Example Output

This shows what the new comprehensive RCA format will look like.

---

# RCA: API Authentication Token Expiry Causing 401 Errors

## I. Incident Overview
* **Date & Time (UTC):** 2025-12-12 14:30:00 UTC
* **Severity (Technical):** Major
* **Impact Summary:** Production API users experiencing intermittent 401 Unauthorized errors after 1 hour of activity, affecting approximately 30% of active sessions and forcing users to re-authenticate.

## II. Technical Analysis (Engineering Perspective)

### Affected Components
* **Services/Modules:**
  - Authentication service (JWT token generation)
  - API Gateway (token validation middleware)
  - Frontend session management
* **Files Likely Involved:**
  - `backend/src/auth/jwt-service.ts`
  - `backend/src/middleware/auth-middleware.ts`
  - `frontend/src/lib/auth-client.ts`

### Root Cause (Technical)
* **The What:** JWT tokens are configured with a 1-hour expiration (`expiresIn: '1h'`), but the frontend refresh token logic is broken and not attempting to renew tokens before expiry.
* **The Trigger:** Any user session lasting longer than 60 minutes triggers token expiry, causing all subsequent API calls to fail with 401 errors.

### Immediate Symptoms
* HTTP 401 Unauthorized errors on API calls
* Users forced to log out and log back in
* Spike in authentication requests
* Error logs showing "Token expired" messages
* Customer support tickets about "getting kicked out"

## III. The "Why" (Deep Dive)

### Five Whys Analysis
1. **Why did the problem occur?** Users receive 401 errors after 1 hour of using the application.
2. **Why did that happen?** JWT access tokens expire after 1 hour and are not being refreshed.
3. **Why was that the case?** The frontend token refresh logic has a bug - it checks `exp` timestamp incorrectly (using seconds instead of milliseconds).
4. **Why wasn't this prevented?** Our E2E tests only run for 5 minutes maximum, never testing long-lived sessions. Code review missed the timestamp unit mismatch.
5. **Root Cause:** Insufficient test coverage for session longevity combined with a subtle unit conversion bug in token expiry checking (`Date.now()` returns milliseconds, JWT `exp` is in seconds).

### Technical Debt Identified
* **Legacy authentication architecture:** Using short-lived tokens without robust refresh mechanism exposes this fragility.
* **Missing observability:** No monitoring on token refresh success/failure rates.
* **Test gaps:** E2E tests don't simulate realistic user session durations.
* **Undocumented assumptions:** JWT library behavior (seconds vs milliseconds) not documented in code comments.

## IV. Proposed Solution

### Immediate Fix (What we'll implement now)
* **Approach:**
  1. Fix token expiry check in frontend auth client (convert JWT exp to milliseconds before comparison)
  2. Implement automatic token refresh 5 minutes before expiry
  3. Add fallback: if refresh fails, attempt to refresh on next API call (before failing with 401)

* **Why this solution:**
  - Minimal code change (single file fix)
  - Backward compatible (doesn't require backend changes)
  - Gracefully handles edge cases (refresh failures)

* **Expected outcome:**
  - Users can stay logged in indefinitely without forced re-authentication
  - Zero user-facing 401 errors from token expiry
  - Seamless session experience

### Files to Change
* `frontend/src/lib/auth-client.ts` - Fix token expiry check: `if (token.exp * 1000 < Date.now())` → `if (token.exp * 1000 < Date.now() + 5 * 60 * 1000)` (refresh 5 min early)
* `frontend/src/lib/api-interceptor.ts` - Add 401 retry logic: catch 401 → attempt token refresh → retry original request once
* `backend/src/auth/jwt-service.ts` - Add refresh token endpoint logging for monitoring
* `frontend/src/hooks/use-auth.ts` - Add useEffect to schedule token refresh timer

### Verification Method
* **Automated Tests:** Unit tests for token expiry edge cases, integration test for refresh flow
* **Manual Testing:** See Manual Test Cases below
* **Deployment Strategy:** Canary deployment to 10% of users for 24 hours

### Manual Test Cases
Provide step-by-step test cases for reviewers to manually verify the fix:

#### Test Case 1: Long Session Without Re-authentication
**Steps:**
1. Log in to the application at https://app.example.com/login
2. Perform normal operations (create item, view dashboard, etc.)
3. Leave the browser tab open for 65 minutes (5 min past token expiry)
4. Return to the tab and perform another operation (e.g., click "Create New Item")
5. Check browser console for any errors

**Expected Result:**
- User should NOT see any 401 errors
- User should NOT be redirected to login page
- Operations should complete successfully
- Console should show "Token refreshed successfully" log (if logging is enabled)

**Success Criteria:**
- [ ] No 401 errors in network tab
- [ ] No forced logout/redirect to login
- [ ] API calls succeed after 65 minutes

#### Test Case 2: Token Refresh During Active Use
**Steps:**
1. Log in to the application
2. Wait 55 minutes (5 minutes before token expiry)
3. Observe browser network tab or console logs
4. Continue using the app normally for the next 10 minutes

**Expected Result:**
- Token should be automatically refreshed around the 55-minute mark
- User should not notice any interruption
- All API calls should continue working

**Success Criteria:**
- [ ] Token refresh happens before expiry
- [ ] No user-visible interruption
- [ ] Session continues seamlessly

#### Test Case 3: Refresh Failure Handling
**Steps:**
1. Log in to the application
2. Open browser DevTools → Network tab
3. Add a network throttle or block `/api/auth/refresh` endpoint temporarily
4. Wait until token is about to expire
5. Unblock the endpoint and make an API call

**Expected Result:**
- App should attempt to refresh on the next API call
- If refresh succeeds on retry, user continues normally
- If refresh fails, user is gracefully logged out with clear message

**Success Criteria:**
- [ ] App attempts retry on next API call
- [ ] Graceful error handling (no white screen)
- [ ] Clear error message if refresh ultimately fails

## V. Prevention & Long-term Actions

### Immediate Actions (In this PR)
* [x] Fix token expiry comparison bug
* [x] Add automatic token refresh logic
* [x] Add unit tests for token expiry scenarios
* [x] Update error handling for 401 retries
* [ ] Add logging for token refresh events
* [ ] Document token refresh behavior in code comments

### Follow-up Actions (For backlog)
* [ ] Extend E2E tests to simulate 2+ hour sessions - [Owner: QA Team] [Priority: High]
* [ ] Add monitoring dashboard for auth metrics (token refresh rate, 401 errors, session duration) - [Owner: DevOps] [Priority: High]
* [ ] Refactor to use sliding session windows instead of fixed expiry - [Owner: Backend Team] [Priority: Medium]
* [ ] Implement "remember me" feature for longer-lived sessions - [Owner: Product] [Priority: Low]
* [ ] Code review checklist: Add item for "timestamp unit verification" - [Owner: Eng Lead] [Priority: Medium]

### Monitoring Gaps Identified
* **Missing metrics:**
  - Token refresh attempt rate
  - Token refresh success/failure rate
  - Distribution of session durations
  - 401 error rate broken down by endpoint
* **Missing alerts:**
  - Alert if token refresh failure rate >5%
  - Alert if 401 error rate spikes >10% above baseline
* **Recommended dashboards:**
  - Authentication health dashboard
  - Real-time session metrics

## VI. Business Context (If Applicable)

### User Impact
* **Scope:** ~30% of active users (approximately 450 users during peak hours). Users with sessions >1 hour affected. Power users and admin panel users hit hardest (they stay logged in longest).
* **Business Risk:**
  - **Moderate revenue risk:** Users interrupted mid-workflow may abandon purchase
  - **Brand damage:** Frustrating UX, support ticket volume increased 3x
  - **Data loss risk:** Low - no data corruption, but users may lose unsaved work

### Communication
* **Stakeholder notification needed?** Yes - sent to:
  - Customer Success team (to prep for support tickets)
  - Product Manager (to understand user complaints)
  - Executive team (via weekly incident summary)
* **Status page update?** No - not severe enough for public status page, but mentioned in next release notes as "improved session stability"

---

## Lessons Learned

### What Went Well
* ✅ Rapid identification of root cause (25 minutes from first report to diagnosis)
* ✅ Clear reproduction steps (100% reproducible)
* ✅ Minimal code change needed (low risk fix)

### What Could Be Improved
* ⚠️ Better test coverage would have caught this before production
* ⚠️ Should have monitoring on token refresh - would have detected the failure pattern
* ⚠️ Code review process missed a subtle unit conversion bug

### Key Takeaway
**Short feedback loops matter.** Our E2E tests run for only 5 minutes. Realistic user sessions last hours. This mismatch between test duration and real usage created a blind spot that allowed a time-based bug to reach production.

---

**Next Review Date:** 2025-12-19 (1 week post-deployment)
**Incident Closed:** After monitoring shows 0 token-expiry-related 401s for 7 consecutive days.
