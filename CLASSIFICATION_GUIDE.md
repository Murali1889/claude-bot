# Auto-Classification System

## Overview

The Claude Bot now automatically classifies every problem statement to optimize cost and execution. This happens in real-time when you create a fix job.

## What Gets Classified

### 1. **Complexity** (simple | medium | complex)
Determines which Claude model to use and how many iterations to allow.

- **Simple** (~$0.05/fix)
  - Typos, comments, documentation
  - Style/CSS changes
  - Simple text updates
  - Remove unused code

- **Medium** (~$0.34/fix)
  - Bug fixes
  - New features (small scope)
  - API endpoint changes
  - Component updates

- **Complex** (~$0.80/fix)
  - Architecture changes
  - Database migrations
  - Security vulnerabilities
  - Multi-file refactoring

### 2. **Bug Type**
Categories:
- `frontend` - UI/UX, React components, styling
- `backend` - Server logic, API processing
- `database` - Schema, queries, migrations
- `api` - REST/GraphQL endpoints
- `security` - Vulnerabilities, auth issues
- `performance` - Optimization, slow code
- `ui-ux` - User experience, accessibility
- `authentication` - Login, sessions, tokens
- `deployment` - Build, CI/CD, environment
- `documentation` - Docs, comments, examples
- `testing` - Test coverage, test failures
- `configuration` - Config, env variables
- `other` - General issues

### 3. **Priority** (P0 | P1 | P2 | P3)
Urgency level:

- **P0** - Critical/Blocker
  - Production down
  - Security breaches
  - Data loss
  - All users affected

- **P1** - High Priority
  - Major user impact
  - Login issues
  - Significant bugs
  - Many users affected

- **P2** - Medium Priority (default)
  - Normal bugs
  - Enhancements
  - Some users affected

- **P3** - Low Priority
  - Minor issues
  - Cosmetic changes
  - Documentation updates

---

## How It Works

### Automatic Detection

When you submit a problem statement, the system:

1. **Analyzes keywords** - Looks for specific terms
2. **Examines context** - Understands the problem scope
3. **Assigns confidence** - Rates how sure it is (0-100%)
4. **Stores classification** - Saves to database
5. **Triggers workflow** - Passes complexity to GitHub Actions

### Example Classifications

#### Example 1: Simple Fix
```
Problem: "Fix typo in README.md - 'Claude' is spelled wrong"

Classification:
  Complexity: simple (90% confidence)
  Bug Type: documentation
  Priority: P3
  Estimated Cost: $0.05

Reasoning:
  - Contains "typo" keyword → simple
  - Contains "README" → documentation
  - No urgency indicators → P3
```

#### Example 2: Medium Fix
```
Problem: "Add error handling to the user registration API endpoint"

Classification:
  Complexity: medium (70% confidence)
  Bug Type: api
  Priority: P2
  Estimated Cost: $0.34

Reasoning:
  - Contains "add" + "endpoint" → medium
  - Contains "API endpoint" → api type
  - Normal priority → P2
```

#### Example 3: Complex Fix
```
Problem: "URGENT: Security vulnerability in authentication - SQL injection possible in login form"

Classification:
  Complexity: complex (95% confidence)
  Bug Type: security
  Priority: P0
  Estimated Cost: $0.80

Reasoning:
  - Contains "security vulnerability" → complex
  - Contains "SQL injection" → security
  - Contains "URGENT" → P0
```

---

## Database Schema

New columns added to `fix_jobs` table:

```sql
-- Classification fields
complexity VARCHAR(10) DEFAULT 'medium'
bug_type VARCHAR(50) DEFAULT 'other'
priority VARCHAR(5) DEFAULT 'P2'
classification_confidence JSONB DEFAULT '{"complexity": 50, "bugType": 50, "priority": 50}'
```

### Statistics View

New `fix_jobs_stats` view for analytics:

```sql
SELECT * FROM fix_jobs_stats
WHERE user_id = 'xxx';
```

Returns:
- Total jobs by type/priority/complexity
- Completion rates
- Average completion time
- Estimated costs

---

## API Response

When creating a fix job, you now get:

```json
{
  "success": true,
  "message": "Fix job created successfully",
  "job": {
    "id": "uuid",
    "repository_full_name": "user/repo",
    "problem_statement": "Fix login bug",
    "status": "pending",
    "complexity": "medium",
    "bug_type": "authentication",
    "priority": "P1",
    "created_at": "2024-12-12T..."
  },
  "classification": {
    "complexity": "medium",
    "bugType": "authentication",
    "priority": "P1",
    "confidence": {
      "complexity": 70,
      "bugType": 85,
      "priority": 80
    },
    "reasoning": {
      "complexity": "Requires moderate implementation effort with feature additions or bug fixes",
      "bugType": "Login, session, or user authentication issue",
      "priority": "High Priority - Significant user impact, fix within 1-2 days"
    },
    "estimated_cost": "$0.34"
  }
}
```

---

## Workflow Integration

The optimized workflow (`fix-code-optimized.yml`) uses complexity:

```yaml
inputs:
  complexity:
    description: 'Fix complexity (simple/medium/complex)'
    required: false
    type: choice
    options:
      - simple
      - medium
      - complex
    default: 'medium'
```

Based on complexity:
- **Simple**: Haiku model, 3 RCA turns, 8 fix turns
- **Medium**: Sonnet model, 5 RCA turns, 12 fix turns
- **Complex**: Sonnet model, 7 RCA turns, 15 fix turns

---

## UI Display

### Color Coding

**Complexity:**
- 🟢 Simple - Green
- 🟡 Medium - Yellow
- 🔴 Complex - Red

**Priority:**
- 🔴 P0 - Red (Critical)
- 🟠 P1 - Orange (High)
- 🔵 P2 - Blue (Medium)
- ⚪ P3 - Gray (Low)

**Bug Types:** Each has unique color (purple for frontend, blue for backend, etc.)

### Helper Functions

```typescript
import {
  getComplexityColor,
  getPriorityColor,
  getBugTypeColor,
  getEstimatedCost,
} from '@/lib/problem-classifier';

// Use in components
<span className={getComplexityColor(job.complexity)}>
  {job.complexity}
</span>

<span className={getPriorityColor(job.priority)}>
  {job.priority}
</span>

<span>Estimated: ${getEstimatedCost(job.complexity)}</span>
```

---

## Customization

### Override Auto-Detection

You can manually override classifications in the UI:

```typescript
// When creating a fix job
const response = await fetch('/api/fix/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    problem_statement: 'Fix the bug',
    installation_id: 123,
    repository_id: 456,
    repository_full_name: 'user/repo',
    // Optional overrides
    complexity: 'simple', // force simple complexity
  }),
});
```

### Add Custom Keywords

Edit `frontend/lib/problem-classifier.ts`:

```typescript
function detectComplexity(text: string): Complexity {
  const simpleKeywords = [
    'typo', 'spelling', 'comment',
    // Add your custom keywords here
    'my-simple-keyword',
  ];

  const complexKeywords = [
    'architecture', 'refactor',
    // Add your custom keywords here
    'my-complex-keyword',
  ];

  // ... rest of logic
}
```

---

## Analytics & Insights

### Cost Tracking

```sql
-- Total estimated cost by user
SELECT
  user_id,
  SUM(CASE
    WHEN complexity = 'simple' THEN 0.05
    WHEN complexity = 'medium' THEN 0.34
    WHEN complexity = 'complex' THEN 0.80
  END) as total_estimated_cost
FROM fix_jobs
WHERE status = 'completed'
GROUP BY user_id;
```

### Performance by Type

```sql
-- Success rate by bug type
SELECT
  bug_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 2) as success_rate
FROM fix_jobs
GROUP BY bug_type
ORDER BY total DESC;
```

### Average Time by Complexity

```sql
-- Average completion time by complexity
SELECT
  complexity,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60) as avg_minutes
FROM fix_jobs
WHERE status = 'completed'
GROUP BY complexity;
```

---

## Migration

### Apply Database Changes

1. Run the migration:
```bash
psql $DATABASE_URL -f schema/phase2-classification.sql
```

2. Verify columns exist:
```sql
\d fix_jobs
```

Should show:
- complexity
- bug_type
- priority
- classification_confidence

### Backfill Existing Jobs (Optional)

```sql
-- Classify existing jobs as 'medium' by default
UPDATE fix_jobs
SET
  complexity = 'medium',
  bug_type = 'other',
  priority = 'P2',
  classification_confidence = '{"complexity": 50, "bugType": 50, "priority": 50}'
WHERE complexity IS NULL;
```

---

## Testing

### Test the Classifier

```typescript
import { classifyProblem } from '@/lib/problem-classifier';

// Test various problem statements
const tests = [
  'Fix typo in button label',
  'Add user authentication with OAuth',
  'CRITICAL: Production database is down',
  'Refactor entire authentication system',
];

tests.forEach(problem => {
  const result = classifyProblem(problem);
  console.log(`Problem: ${problem}`);
  console.log(`Complexity: ${result.complexity} (${result.confidence.complexity}%)`);
  console.log(`Type: ${result.bugType} (${result.confidence.bugType}%)`);
  console.log(`Priority: ${result.priority} (${result.confidence.priority}%)`);
  console.log('---');
});
```

---

## Best Practices

### Writing Problem Statements

For **best auto-detection**, include:

1. **Action verb** - "Fix", "Add", "Refactor", "Update"
2. **Component/file** - "in auth.ts", "login form", "API endpoint"
3. **Urgency** (if applicable) - "URGENT", "critical", "blocker"
4. **Scope** - Be specific about what's affected

#### Good Examples:
✅ "Fix SQL injection vulnerability in user login endpoint"
✅ "Add loading spinner to checkout button"
✅ "URGENT: Production API returning 500 errors for all users"
✅ "Update documentation for new authentication flow"

#### Bad Examples:
❌ "Fix bug" - Too vague
❌ "The thing is broken" - No context
❌ "Please help" - No information

---

## Troubleshooting

### Low Confidence Scores

If confidence is < 60%, the classification might be uncertain:

- Review the problem statement
- Add more specific keywords
- Manually override if needed

### Wrong Classification

If the auto-detection is consistently wrong:

1. Check keywords in `problem-classifier.ts`
2. Add your domain-specific terms
3. Adjust scoring logic
4. Consider manual override for edge cases

### Missing Classifications

If jobs aren't getting classified:

1. Check database migration ran successfully
2. Verify API endpoint is calling `classifyProblem()`
3. Check console logs for errors
4. Ensure TypeScript types are updated

---

## Future Enhancements

Planned improvements:

- [ ] Machine learning model for better accuracy
- [ ] Learn from user corrections
- [ ] Historical pattern recognition
- [ ] Multi-language support
- [ ] Custom classification rules per user/org
- [ ] A/B testing different thresholds
- [ ] Real-time cost predictions
- [ ] Complexity adjustment based on outcomes

---

## Support

For issues or questions:
- Check console logs for classification details
- Review `COST_OPTIMIZATION.md` for cost analysis
- Open an issue on GitHub

---

*Last updated: December 2024*
