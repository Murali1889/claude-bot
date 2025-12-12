# Claude Bot - Cost Optimization Guide

## 📊 Cost Comparison

### Current Workflow vs Optimized Workflow

| Metric | Original | Optimized | Savings |
|--------|----------|-----------|---------|
| **RCA Max Turns** | 10 | 3-7 | 30-70% |
| **Doc Max Turns** | 15 | 5-10 | 33-67% |
| **Fix Max Turns** | 20 | 8-15 | 25-60% |
| **Model Strategy** | All Sonnet | Haiku + Sonnet | 50-70% |
| **Avg Cost/Run** | $1.00-$5.00 | $0.15-$0.80 | **70-85%** |

---

## 💰 Detailed Cost Breakdown

### Model Pricing (as of Dec 2024)

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Use Case |
|-------|----------------------|------------------------|----------|
| **Claude Haiku 3.5** | $0.80 | $4.00 | Analysis, RCA, Docs |
| **Claude Sonnet 4.5** | $3.00 | $15.00 | Code changes |
| **Claude Opus 4.5** | $15.00 | $75.00 | Critical fixes only |

---

## 🎯 Cost Per Run Estimates

### Small Codebase (5 files, ~1000 lines)

#### Original Workflow
```
Phase 1 - RCA (Sonnet, 10 turns)
  Input:  50,000 tokens × $3.00  = $0.15
  Output:  5,000 tokens × $15.00 = $0.075
  Subtotal: $0.225

Phase 2 - Documentation (Sonnet, 15 turns)
  Input:  80,000 tokens × $3.00  = $0.24
  Output:  8,000 tokens × $15.00 = $0.12
  Subtotal: $0.36

Phase 3 - Code Changes (Sonnet, 20 turns)
  Input:  100,000 tokens × $3.00 = $0.30
  Output: 10,000 tokens × $15.00 = $0.15
  Subtotal: $0.45

TOTAL: $1.04 per run
```

#### Optimized Workflow (Medium Complexity)
```
Phase 1 - RCA (Haiku, 5 turns)
  Input:  25,000 tokens × $0.80  = $0.02
  Output:  2,000 tokens × $4.00  = $0.008
  Subtotal: $0.028

Phase 2 - Documentation (Haiku, 8 turns, REUSED after first run)
  First run: $0.05
  Subsequent runs: $0 (file exists!)

Phase 3 - Code Changes (Sonnet, 12 turns)
  Input:  70,000 tokens × $3.00  = $0.21
  Output:  7,000 tokens × $15.00 = $0.105
  Subtotal: $0.315

TOTAL: $0.39 first run, $0.34 subsequent runs
Savings: 63-67%
```

#### Optimized Workflow (Simple Complexity)
```
Phase 1 - RCA (SKIPPED)
  Cost: $0

Phase 2 - Documentation (REUSED)
  Cost: $0

Phase 3 - Code Changes (Haiku, 8 turns)
  Input:  40,000 tokens × $0.80  = $0.032
  Output:  4,000 tokens × $4.00  = $0.016
  Subtotal: $0.048

TOTAL: $0.05 per run
Savings: 95%!
```

---

## 📈 Monthly Cost Projections

### Scenario: 100 fixes per month, 5-file codebase

| Workflow Type | Cost/Run | Monthly Cost | Annual Cost |
|--------------|----------|--------------|-------------|
| **Original** | $1.04 | $104 | $1,248 |
| **Optimized (Medium)** | $0.34 | $34 | $408 |
| **Optimized (Simple)** | $0.05 | $5 | $60 |
| **Mixed (50% simple, 30% medium, 20% complex)** | $0.28 avg | $28 | $336 |

**Annual Savings: $912 (73%)**

---

## 🚀 Optimization Strategies Implemented

### 1. **Smart Model Selection** (50-70% savings)
- ✅ Use **Haiku** for RCA and documentation (4x cheaper than Sonnet)
- ✅ Use **Sonnet** only for actual code changes
- ✅ Reserve **Opus** for critical/complex fixes

### 2. **Reduced Max Turns** (30-60% savings)
- ✅ Better prompts = fewer iterations needed
- ✅ Original: 45 total turns → Optimized: 16-32 turns
- ✅ More focused instructions reduce back-and-forth

### 3. **Codebase Documentation Reuse** (100% savings after first run)
- ✅ Create `code_base.md` once, reuse forever
- ✅ Only regenerate if major changes detected
- ✅ Saves $0.05-0.36 per run after first time

### 4. **Conditional RCA** (100% savings for simple fixes)
- ✅ Skip RCA for obvious/simple fixes
- ✅ User can specify complexity level
- ✅ Auto-detect based on problem statement

### 5. **Focused Prompts** (20-40% savings)
- ✅ Clear, specific instructions
- ✅ Request concise responses
- ✅ Set word/line limits
- ✅ Avoid unnecessary analysis

### 6. **Targeted File Analysis** (Future optimization)
- 🔄 Only analyze files mentioned in RCA
- 🔄 Skip irrelevant directories (node_modules, dist, etc.)
- 🔄 Use `.claudeignore` file

---

## 🎛️ Complexity Levels Guide

### When to use **SIMPLE** (Cost: ~$0.05)
- ✅ Typo fixes
- ✅ Simple bug fixes (obvious cause)
- ✅ Documentation updates
- ✅ Configuration changes
- ✅ Adding console.log or comments

### When to use **MEDIUM** (Cost: ~$0.34)
- ✅ Feature additions (small scope)
- ✅ Bug fixes (moderate complexity)
- ✅ Refactoring single components
- ✅ API endpoint changes
- ✅ Most typical fixes

### When to use **COMPLEX** (Cost: ~$0.80)
- ✅ Architectural changes
- ✅ Multi-file refactoring
- ✅ Database schema changes
- ✅ Security vulnerabilities
- ✅ Performance optimizations

---

## 💡 Best Practices for Cost Efficiency

### 1. **Be Specific in Problem Statements**
❌ Bad: "Fix the login bug"
✅ Good: "Fix login bug in auth.ts where session token expires immediately"

**Why:** Specific problems = faster diagnosis = fewer Claude turns

### 2. **Maintain code_base.md**
- Keep it updated manually or regenerate quarterly
- Prevents wasted tokens re-analyzing the same codebase
- **Saves:** $0.36 per subsequent run

### 3. **Use Appropriate Complexity Levels**
- Don't default to "complex" for everything
- 70% of fixes can be "simple" or "medium"
- **Saves:** Up to $0.75 per run

### 4. **Batch Similar Fixes**
- If you have 5 typos, create 1 issue listing all 5
- Claude can fix them together
- **Saves:** 4x workflow execution costs

### 5. **Monitor and Adjust**
- Track which fixes succeed with fewer turns
- Adjust max-turns based on actual usage
- Review Claude CLI logs to see token usage

---

## 📊 ROI Calculator

### Example: Small Startup (50 fixes/month)

| Metric | Original | Optimized | Difference |
|--------|----------|-----------|------------|
| Monthly Cost | $52 | $14 | **-$38** |
| Annual Cost | $624 | $168 | **-$456** |
| Cost per Fix | $1.04 | $0.28 | **-$0.76** |

### Example: Growing Company (200 fixes/month)

| Metric | Original | Optimized | Difference |
|--------|----------|-----------|------------|
| Monthly Cost | $208 | $56 | **-$152** |
| Annual Cost | $2,496 | $672 | **-$1,824** |
| Cost per Fix | $1.04 | $0.28 | **-$0.76** |

---

## 🔧 Implementation Steps

### 1. Replace Your Workflow File
```bash
# Backup original
cp .github/workflows/fix-code.yml .github/workflows/fix-code.yml.backup

# Use optimized version
cp fix-code-optimized.yml .github/workflows/fix-code.yml
```

### 2. Update Your Frontend to Pass Complexity
In your fix job creation API, add complexity detection:

```typescript
// frontend/app/api/fix/create/route.ts

// Auto-detect complexity based on keywords
function detectComplexity(problemStatement: string): string {
  const simple = ['typo', 'comment', 'log', 'documentation', 'readme'];
  const complex = ['architecture', 'refactor', 'database', 'migration', 'security'];

  const lower = problemStatement.toLowerCase();

  if (simple.some(word => lower.includes(word))) return 'simple';
  if (complex.some(word => lower.includes(word))) return 'complex';

  return 'medium'; // default
}

// When triggering workflow
const complexity = detectComplexity(problem_statement);
```

### 3. Monitor Costs
Add cost tracking to your dashboard:

```typescript
// Track estimated cost per job
const COSTS = {
  simple: 0.05,
  medium: 0.34,
  complex: 0.80,
};

// Display in UI
const estimatedCost = COSTS[job.complexity] || 0.28;
```

---

## 🎯 Advanced Optimizations (Future)

### 1. **Prompt Caching** (Coming Soon)
- Anthropic's prompt caching can reduce costs by 90%
- Cache the codebase context
- **Potential savings:** Additional 50-70%

### 2. **Incremental Analysis**
- Only analyze files changed since last run
- Use git diff to identify scope
- **Potential savings:** 40-60% for large codebases

### 3. **Rate Limiting**
- Queue fixes during off-peak hours
- Batch multiple fixes together
- **Potential savings:** 10-20% through efficiency

### 4. **Custom Fine-Tuned Models**
- Train on your codebase patterns
- Reduce turns needed
- **Potential savings:** 30-50% (requires investment)

---

## 📞 Support & Monitoring

### Track Your Costs
1. Monitor Anthropic API usage: https://console.anthropic.com
2. Check GitHub Actions minutes
3. Review job completion rates

### Optimize Further
- If jobs complete in fewer turns, reduce max-turns
- If jobs fail, increase max-turns for that complexity
- A/B test different model combinations

---

## 🎉 Summary

With these optimizations, you've reduced costs by **70-85%** while maintaining quality:

✅ **$1.04 → $0.28** average cost per run
✅ Smart model selection (Haiku for analysis)
✅ Reduced unnecessary iterations
✅ Reusable codebase documentation
✅ Complexity-based execution

**Annual savings for 100 fixes/month: ~$912**

---

*Last updated: December 2024*
*Claude API pricing: https://www.anthropic.com/pricing*
