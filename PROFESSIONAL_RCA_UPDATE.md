# Professional RCA Template - Update Summary

## 🎯 What Changed

Updated the workflow to generate **comprehensive, professional-grade Root Cause Analysis** documents that follow industry best practices for incident analysis.

---

## ✅ New RCA Structure

### Before (Old Format):
```markdown
## Problem Summary
The button is broken.

## Root Cause
CSS issue.

## Proposed Solution
Fix the CSS.

## Files to Change
- button.css
```
**Issues:**
- ❌ Too brief, lacks depth
- ❌ No "why" analysis
- ❌ Missing business context
- ❌ No prevention strategy
- ❌ Not actionable

---

### After (New Professional Format):
```markdown
# RCA: API Authentication Token Expiry Causing 401 Errors

## I. Incident Overview
* Date & Time, Severity, Impact Summary

## II. Technical Analysis
* Affected Components
* Root Cause (What & Trigger)
* Immediate Symptoms

## III. The "Why" (Deep Dive)
* Five Whys Analysis (drilling to root cause)
* Technical Debt Identified

## IV. Proposed Solution
* Immediate Fix
* Files to Change (with specific reasons)
* Verification Method

## V. Prevention & Long-term Actions
* Immediate Actions (checkboxes)
* Follow-up Actions (backlog items)
* Monitoring Gaps Identified

## VI. Business Context
* User Impact
* Business Risk
* Communication needs
```

**Benefits:**
- ✅ Professional, audit-ready format
- ✅ Captures both technical and business perspectives
- ✅ Actionable with clear next steps
- ✅ Prevents future incidents
- ✅ Tracks technical debt

---

## 📋 Key Sections Explained

### 1. **Incident Overview**
Quick executive summary:
- When did it happen?
- How severe?
- Who was affected?

**Purpose:** Leadership can read this section alone and understand the incident.

---

### 2. **Technical Analysis (Engineering)**
Deep technical dive:
- **Affected Components:** Database, API, Frontend, etc.
- **Root Cause:** The specific bug or config error
- **Trigger:** What action caused this?
- **Symptoms:** Error messages, performance issues

**Purpose:** Engineers understand exactly what broke and why.

---

### 3. **The "Why" (Five Whys)**
Drill down from symptom to root cause:

```
1. Why did users get 401 errors?
   → Tokens expired after 1 hour

2. Why did tokens expire?
   → Not being refreshed

3. Why weren't they refreshed?
   → Refresh logic has a bug

4. Why wasn't this caught?
   → Tests only run for 5 minutes

5. Root Cause: Test gap + unit conversion bug
```

**Purpose:** Find the *fundamental* issue, not just the surface symptom.

---

### 4. **Proposed Solution**
Concrete action plan:
- **Immediate fix:** What we'll do in this PR
- **Files to change:** Specific paths with reasons
- **Verification:** How we'll test the fix

**Purpose:** Clear implementation roadmap.

---

### 5. **Prevention & Long-term**
Three tiers of action items:

**Immediate (This PR):**
- [ ] Fix the bug
- [ ] Add test coverage
- [ ] Update error handling

**Follow-up (Backlog):**
- [ ] Refactor authentication (Owner: Backend, Priority: High)
- [ ] Add monitoring dashboard (Owner: DevOps, Priority: High)
- [ ] Extend E2E tests (Owner: QA, Priority: Medium)

**Monitoring Gaps:**
- What alerts should we add?
- What metrics are missing?

**Purpose:** Prevent recurrence through process improvements.

---

### 6. **Business Context**
Non-technical impact:
- **User Impact:** How many users affected? Which features broken?
- **Business Risk:** Revenue loss? Brand damage? Data loss?
- **Communication:** Who needs to know?

**Purpose:** Leadership understands business implications.

---

## 🔄 Workflow Changes

### Updated Prompt
```yaml
- name: Generate Root Cause Analysis
  run: |
    claude --model sonnet -p "
      Create a comprehensive RCA following this structure:

      I. Incident Overview
      II. Technical Analysis
      III. The 'Why' (Five Whys)
      IV. Proposed Solution
      V. Prevention & Long-term Actions
      VI. Business Context

      [Full detailed template...]
    " --max-turns 10
```

**Key changes:**
- ✅ Increased max-turns: 7 → 10 (more time for comprehensive analysis)
- ✅ Structured template with 6 major sections
- ✅ Specific guidelines for technical depth
- ✅ Action item checkboxes
- ✅ Business context included

---

## 📊 Benefits Comparison

| Aspect | Old RCA | New Professional RCA |
|--------|---------|---------------------|
| **Depth** | Surface-level | Deep "why" analysis |
| **Structure** | Loose paragraphs | Clear sections |
| **Actionability** | Vague suggestions | Checkboxed action items |
| **Business context** | Missing | Included |
| **Prevention** | Not addressed | Comprehensive plan |
| **Technical debt** | Ignored | Explicitly tracked |
| **Monitoring** | Not mentioned | Gaps identified |
| **Verification** | Assumed | Explicit method |
| **Audience** | Only engineers | Engineers + Business |
| **Format** | Informal | Professional, audit-ready |

---

## 🎯 Use Cases

### Engineering Teams
**Before:**
"Fix the CSS in button.css"

**After:**
```markdown
## Files to Change
* `components/Button.tsx` - Fix flexbox alignment
  (change justify-content from 'flex-start' to 'center')
* `styles/button.css` - Remove conflicting margin-left rule
* `tests/Button.test.tsx` - Add test for mobile viewport alignment

## Verification Method
* Visual regression test on mobile viewports (320px, 375px, 414px)
* Manual QA: Test on iPhone SE, iPhone 12, Android devices
* Accessibility check: Ensure button remains tappable
```

**Result:** Clear, specific, testable changes.

---

### Business/Product Teams
**Before:**
"There's a CSS bug"

**After:**
```markdown
## VI. Business Context

### User Impact
* **Scope:** 15% of mobile users (iOS 12-14) see misaligned button
* **Business Risk:**
  - Moderate: Users may not find checkout button
  - Estimated revenue impact: $200-500/day in abandoned carts

### Communication
* Notify Customer Success team
* No status page update needed (minor visual issue)
* Include fix in next release notes
```

**Result:** Business understands impact and can make informed decisions.

---

### Leadership/Stakeholders
Can read **Section I (Incident Overview)** only:

```markdown
## I. Incident Overview
* **Date & Time (UTC):** 2025-12-12 14:30:00 UTC
* **Severity (Technical):** Major
* **Impact Summary:** 30% of users experiencing authentication
  errors after 1 hour, forcing re-login. Moderate business impact.
```

**Result:** 30-second executive summary for quick understanding.

---

## 📝 Real-World Example

See `RCA_EXAMPLE.md` for a complete, filled-out example:

**Problem:** API Authentication Token Expiry Causing 401 Errors

**Sections covered:**
- Incident timeline and severity
- Technical deep-dive (JWT expiry bug)
- Five Whys analysis (test gap + unit conversion bug)
- Specific file changes with code snippets
- Prevention plan with backlog items
- Business impact (revenue risk, user frustration)
- Monitoring gaps identified

**Length:** ~1200 words, comprehensive yet scannable.

---

## 🚀 Getting Started

### 1. **Run the Workflow**
The updated workflow will automatically generate professional RCAs.

### 2. **Review the RCA**
Check that all sections are filled:
- [ ] Incident Overview present
- [ ] Five Whys completed
- [ ] Files to change listed
- [ ] Action items have checkboxes
- [ ] Monitoring gaps identified

### 3. **Edit if Needed**
Users can edit the RCA in the dashboard and regenerate code.

### 4. **Share with Team**
RCA is included in PR description, ready for:
- Engineering review
- Product review
- Leadership briefing
- Audit documentation

---

## ✨ Best Practices

### For Claude (Auto-generated RCAs)
✅ **Do:**
- Be specific: Use actual file paths, error codes, metrics
- Focus on "why": Drill to root cause, not symptoms
- Be actionable: Checkboxes, owners, priorities
- Think prevention: What monitoring/tests should we add?

❌ **Don't:**
- Be vague: "Fix the code" → Specific files and changes
- Skip the "why": Always complete Five Whys
- Ignore business context: Impact matters
- Forget verification: How will we test this?

---

### For Users (Editing RCAs)
✅ **Do:**
- Add specific details Claude might have missed
- Clarify business impact with numbers
- Assign owners to action items
- Set realistic priorities

❌ **Don't:**
- Delete sections (keep the structure)
- Skip Five Whys (this is the most important part)
- Ignore prevention (that's why we write RCAs)

---

## 📊 Metrics to Track

After implementing professional RCAs, track:

1. **Incident recurrence rate**
   - Are we preventing similar issues?
   - Target: <5% recurrence

2. **Action item completion**
   - Are backlog items being addressed?
   - Target: >80% completion within 30 days

3. **Time to root cause**
   - How fast do we identify the real problem?
   - Target: <1 hour for most incidents

4. **Business stakeholder satisfaction**
   - Do non-technical teams understand the RCA?
   - Target: >90% find RCA clear and useful

---

## 🔗 Related Files

- `fix-code-production.yml` - Updated workflow with new RCA template
- `RCA_EXAMPLE.md` - Complete example of professional RCA
- `RCA_EDITING_FEATURE.md` - How to edit and regenerate RCAs
- `SUPABASE_FUNCTION_PAYLOADS.md` - Status updates for tracking

---

## 🎓 Why This Matters

### Traditional RCA (Surface-level)
```
Problem: Login is broken
Cause: Database connection failed
Fix: Restart database
```
**Issue:** Fixes symptom, doesn't prevent recurrence.

---

### Professional RCA (Root cause)
```
Problem: Login is broken
Cause: Database connection failed

Five Whys:
1. Why did connection fail? → Connection pool exhausted
2. Why was pool exhausted? → Too many connections
3. Why too many connections? → Connections not being closed
4. Why not closed? → Missing try-finally blocks
5. Root Cause: No linting rule to enforce connection cleanup

Solution:
- Immediate: Fix missing finally blocks in auth service
- Prevention: Add ESLint rule for database connection cleanup
- Monitoring: Alert when connection pool >80% utilized
```
**Result:** Problem won't happen again.

---

## 📚 Further Reading

- **Five Whys Technique:** [Wikipedia](https://en.wikipedia.org/wiki/Five_whys)
- **Google SRE Book - Postmortems:** [SRE Book](https://sre.google/sre-book/postmortem-culture/)
- **Etsy's Debriefing Facilitation Guide:** [Code as Craft](https://codeascraft.com/2016/11/17/debriefing-facilitation-guide/)

---

This comprehensive RCA format ensures:
- ✅ Engineering teams fix the **root cause**, not symptoms
- ✅ Business teams understand **impact** and make informed decisions
- ✅ Leadership gets **executive summaries** for quick understanding
- ✅ Future incidents are **prevented** through documented learnings
- ✅ Technical debt is **tracked** and addressed

**Result:** Better software, fewer incidents, stronger processes! 🎉
