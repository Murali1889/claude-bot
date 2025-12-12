/**
 * Problem Statement Classifier
 *
 * Auto-detects:
 * - Complexity (simple/medium/complex)
 * - Bug Type (frontend/backend/security/performance/etc.)
 * - Priority (P0/P1/P2/P3)
 *
 * Based on keywords and patterns in the problem statement
 */

export type Complexity = 'simple' | 'medium' | 'complex';

export type BugType =
  | 'frontend'
  | 'backend'
  | 'database'
  | 'api'
  | 'security'
  | 'performance'
  | 'ui-ux'
  | 'authentication'
  | 'deployment'
  | 'documentation'
  | 'testing'
  | 'configuration'
  | 'other';

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export interface ProblemClassification {
  complexity: Complexity;
  bugType: BugType;
  priority: Priority;
  confidence: {
    complexity: number;
    bugType: number;
    priority: number;
  };
  reasoning: {
    complexity: string;
    bugType: string;
    priority: string;
  };
}

/**
 * Classify a problem statement
 */
export function classifyProblem(problemStatement: string): ProblemClassification {
  const lower = problemStatement.toLowerCase();

  return {
    complexity: detectComplexity(lower),
    bugType: detectBugType(lower),
    priority: detectPriority(lower),
    confidence: {
      complexity: calculateComplexityConfidence(lower),
      bugType: calculateBugTypeConfidence(lower),
      priority: calculatePriorityConfidence(lower),
    },
    reasoning: {
      complexity: explainComplexity(lower),
      bugType: explainBugType(lower),
      priority: explainPriority(lower),
    },
  };
}

/**
 * Detect complexity level
 */
function detectComplexity(text: string): Complexity {
  // Simple indicators
  const simpleKeywords = [
    'typo', 'spelling', 'comment', 'log', 'console.log',
    'documentation', 'readme', 'docs', 'text',
    'label', 'title', 'placeholder', 'tooltip',
    'color', 'css', 'style', 'spacing', 'margin', 'padding',
    'rename', 'remove unused', 'dead code',
  ];

  // Complex indicators
  const complexKeywords = [
    'architecture', 'redesign', 'refactor entire', 'rewrite',
    'database schema', 'migration', 'upgrade',
    'security vulnerability', 'sql injection', 'xss', 'csrf',
    'performance optimization', 'memory leak', 'race condition',
    'distributed', 'scalability', 'microservice',
    'authentication system', 'authorization',
    'real-time', 'websocket', 'streaming',
    'infrastructure', 'deployment pipeline',
  ];

  // Medium indicators (more specific than simple, less than complex)
  const mediumKeywords = [
    'add feature', 'implement', 'create endpoint',
    'bug fix', 'error handling', 'validation',
    'api endpoint', 'route', 'controller',
    'component', 'form', 'modal', 'dropdown',
    'integration', 'third-party', 'service',
    'cache', 'state management',
  ];

  // Count matches
  const simpleScore = simpleKeywords.filter(k => text.includes(k)).length;
  const complexScore = complexKeywords.filter(k => text.includes(k)).length;
  const mediumScore = mediumKeywords.filter(k => text.includes(k)).length;

  // Length-based heuristic
  const wordCount = text.split(/\s+/).length;
  if (wordCount <= 10 && complexScore === 0) {
    return 'simple';
  }

  // Decision logic
  if (complexScore > 0) return 'complex';
  if (simpleScore > mediumScore && simpleScore > 0) return 'simple';
  if (mediumScore > 0 || wordCount > 30) return 'medium';

  return 'medium'; // default
}

/**
 * Detect bug type
 */
function detectBugType(text: string): BugType {
  const patterns: Record<BugType, string[]> = {
    frontend: [
      'ui', 'ux', 'react', 'component', 'render', 'display',
      'button', 'form', 'input', 'modal', 'dropdown',
      'css', 'style', 'layout', 'responsive',
      'click', 'hover', 'animation', 'transition',
      'next.js', 'tailwind', 'typescript',
    ],
    backend: [
      'server', 'api', 'endpoint', 'route', 'controller',
      'service', 'business logic', 'processing',
      'node.js', 'express', 'fastify',
      'request', 'response', 'middleware',
    ],
    database: [
      'database', 'db', 'sql', 'query', 'table', 'column',
      'postgres', 'mysql', 'mongodb', 'supabase',
      'migration', 'schema', 'index',
      'insert', 'update', 'delete', 'select',
    ],
    api: [
      'rest api', 'graphql', 'webhook', 'http',
      'get', 'post', 'put', 'patch', 'delete',
      'status code', '404', '500', '401', '403',
      'json', 'payload', 'headers',
    ],
    security: [
      'security', 'vulnerability', 'exploit',
      'xss', 'csrf', 'sql injection', 'authentication',
      'authorization', 'permission', 'access control',
      'token', 'jwt', 'oauth', 'encryption',
      'password', 'credential', 'secret',
    ],
    performance: [
      'performance', 'slow', 'optimization', 'speed',
      'memory leak', 'cpu', 'latency', 'timeout',
      'cache', 'caching', 'lazy load',
      'bundle size', 'load time', 'ttfb',
    ],
    'ui-ux': [
      'user experience', 'usability', 'accessibility',
      'a11y', 'aria', 'screen reader',
      'navigation', 'flow', 'user journey',
      'mobile', 'tablet', 'desktop',
    ],
    authentication: [
      'login', 'logout', 'sign in', 'sign up',
      'session', 'cookie', 'token expired',
      'password reset', 'forgot password',
      'email verification', '2fa', 'mfa',
    ],
    deployment: [
      'deployment', 'build', 'ci/cd', 'pipeline',
      'docker', 'kubernetes', 'vercel', 'netlify',
      'environment', 'production', 'staging',
      'deploy failed', 'build error',
    ],
    documentation: [
      'documentation', 'docs', 'readme', 'comment',
      'jsdoc', 'type definition', 'interface',
      'example', 'guide', 'tutorial',
    ],
    testing: [
      'test', 'jest', 'vitest', 'cypress', 'playwright',
      'unit test', 'integration test', 'e2e',
      'coverage', 'mock', 'stub',
    ],
    configuration: [
      'config', 'configuration', 'settings', 'env',
      'environment variable', '.env',
      'package.json', 'tsconfig', 'eslint',
    ],
    other: [],
  };

  // Score each category
  const scores: Record<BugType, number> = {
    frontend: 0,
    backend: 0,
    database: 0,
    api: 0,
    security: 0,
    performance: 0,
    'ui-ux': 0,
    authentication: 0,
    deployment: 0,
    documentation: 0,
    testing: 0,
    configuration: 0,
    other: 0,
  };

  for (const [type, keywords] of Object.entries(patterns)) {
    scores[type as BugType] = keywords.filter(k => text.includes(k)).length;
  }

  // Find highest score
  let maxScore = 0;
  let detectedType: BugType = 'other';

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedType = type as BugType;
    }
  }

  return detectedType;
}

/**
 * Detect priority level
 */
function detectPriority(text: string): Priority {
  // P0 - Critical/Blocker
  const p0Keywords = [
    'critical', 'blocker', 'urgent', 'asap', 'emergency',
    'production down', 'outage', 'broken', 'not working',
    'security breach', 'data loss', 'exploit',
    'all users affected', 'complete failure',
    'payment failing', 'checkout broken',
  ];

  // P1 - High Priority
  const p1Keywords = [
    'high priority', 'important', 'major',
    'user impact', 'many users', 'regression',
    'login issue', 'authentication failing',
    'data corruption', 'incorrect calculation',
    'performance issue', 'very slow',
  ];

  // P2 - Medium Priority
  const p2Keywords = [
    'medium', 'normal', 'improvement',
    'some users', 'intermittent', 'sometimes',
    'minor bug', 'edge case',
    'nice to have', 'enhancement',
  ];

  // P3 - Low Priority
  const p3Keywords = [
    'low priority', 'minor', 'trivial',
    'typo', 'cosmetic', 'polish',
    'documentation', 'comment',
    'cleanup', 'refactor',
  ];

  // Check for matches
  const p0Score = p0Keywords.filter(k => text.includes(k)).length;
  const p1Score = p1Keywords.filter(k => text.includes(k)).length;
  const p2Score = p2Keywords.filter(k => text.includes(k)).length;
  const p3Score = p3Keywords.filter(k => text.includes(k)).length;

  // Additional heuristics
  const hasExclamation = (text.match(/!/g) || []).length >= 2;
  const hasAllCaps = /[A-Z]{3,}/.test(text);
  const mentionsUsers = /users?|customers?|clients?/i.test(text);
  const mentionsProduction = /production|prod|live/i.test(text);

  // Decision logic
  if (p0Score > 0 || (hasExclamation && mentionsProduction)) return 'P0';
  if (p1Score > 0 || (mentionsUsers && p2Score === 0)) return 'P1';
  if (p3Score > p2Score && p3Score > 0) return 'P3';

  return 'P2'; // default to medium
}

/**
 * Calculate confidence scores (0-100)
 */
function calculateComplexityConfidence(text: string): number {
  const words = text.split(/\s+/).length;

  // Simple heuristic based on keyword matches and length
  const hasStrongIndicator = /typo|comment|documentation|architecture|refactor/i.test(text);

  if (hasStrongIndicator) return 90;
  if (words > 50) return 70;
  if (words > 20) return 60;
  if (words <= 10) return 80;

  return 50; // default
}

function calculateBugTypeConfidence(text: string): number {
  const bugType = detectBugType(text);

  if (bugType === 'other') return 30;

  // Count specific keywords
  const specificKeywords = text.match(/\b(frontend|backend|database|api|security|performance)\b/gi);
  if (specificKeywords && specificKeywords.length > 0) return 95;

  return 70; // default
}

function calculatePriorityConfidence(text: string): number {
  const hasExplicitPriority = /\b(critical|blocker|urgent|low priority|high priority)\b/i.test(text);

  if (hasExplicitPriority) return 95;

  return 60; // default
}

/**
 * Explain reasoning for classifications
 */
function explainComplexity(text: string): string {
  const complexity = detectComplexity(text);

  if (complexity === 'simple') {
    return 'Contains simple fix keywords like typo, documentation, or styling';
  } else if (complexity === 'complex') {
    return 'Involves architectural changes, security, or system-wide modifications';
  } else {
    return 'Requires moderate implementation effort with feature additions or bug fixes';
  }
}

function explainBugType(text: string): string {
  const bugType = detectBugType(text);

  const explanations: Record<BugType, string> = {
    frontend: 'UI/UX issue affecting user interface components',
    backend: 'Server-side logic or API processing issue',
    database: 'Database schema, query, or data integrity issue',
    api: 'REST/GraphQL API endpoint or integration issue',
    security: 'Security vulnerability or access control issue',
    performance: 'Performance, optimization, or resource usage issue',
    'ui-ux': 'User experience or accessibility concern',
    authentication: 'Login, session, or user authentication issue',
    deployment: 'Build, deployment, or environment configuration issue',
    documentation: 'Documentation, comments, or examples update',
    testing: 'Test coverage, test failures, or testing infrastructure',
    configuration: 'Configuration, settings, or environment variables',
    other: 'General issue not matching specific categories',
  };

  return explanations[bugType];
}

function explainPriority(text: string): string {
  const priority = detectPriority(text);

  const explanations: Record<Priority, string> = {
    P0: 'Critical/Blocker - Immediate attention required, production impact',
    P1: 'High Priority - Significant user impact, fix within 1-2 days',
    P2: 'Medium Priority - Normal fix, schedule within sprint',
    P3: 'Low Priority - Nice to have, can be deferred',
  };

  return explanations[priority];
}

/**
 * Get human-readable labels
 */
export function getComplexityLabel(complexity: Complexity): string {
  const labels: Record<Complexity, string> = {
    simple: 'Simple',
    medium: 'Medium',
    complex: 'Complex',
  };
  return labels[complexity];
}

export function getBugTypeLabel(bugType: BugType): string {
  const labels: Record<BugType, string> = {
    frontend: 'Frontend',
    backend: 'Backend',
    database: 'Database',
    api: 'API',
    security: 'Security',
    performance: 'Performance',
    'ui-ux': 'UI/UX',
    authentication: 'Authentication',
    deployment: 'Deployment',
    documentation: 'Documentation',
    testing: 'Testing',
    configuration: 'Configuration',
    other: 'Other',
  };
  return labels[bugType];
}

export function getPriorityLabel(priority: Priority): string {
  return priority;
}

/**
 * Get color classes for UI display
 */
export function getComplexityColor(complexity: Complexity): string {
  const colors: Record<Complexity, string> = {
    simple: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
    medium: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
    complex: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
  };
  return colors[complexity];
}

export function getPriorityColor(priority: Priority): string {
  const colors: Record<Priority, string> = {
    P0: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
    P1: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
    P2: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
    P3: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  };
  return colors[priority];
}

export function getBugTypeColor(bugType: BugType): string {
  const colors: Record<BugType, string> = {
    frontend: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
    backend: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
    database: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
    api: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400',
    security: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
    performance: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
    'ui-ux': 'bg-pink-100 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400',
    authentication: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
    deployment: 'bg-teal-100 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400',
    documentation: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
    testing: 'bg-cyan-100 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400',
    configuration: 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    other: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  };
  return colors[bugType];
}

/**
 * Get cost estimate based on complexity
 */
export function getEstimatedCost(complexity: Complexity): number {
  const costs: Record<Complexity, number> = {
    simple: 0.05,
    medium: 0.34,
    complex: 0.80,
  };
  return costs[complexity];
}
