"use client";

import { useState, useEffect } from "react";

type Installation = {
  installation_id: number;
  account_login: string;
  account_type: string;
};

export default function TestPage() {
  const [apiKey, setApiKey] = useState("");
  const [problem, setProblem] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check authentication on mount and handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    if (code) {
      // Handle OAuth callback
      handleOAuthCallback(code);
    } else {
      checkAuth();
    }
  }, []);

  async function handleOAuthCallback(code: string) {
    try {
      // Clean the URL
      window.history.replaceState({}, "", "/test");

      // For test page, we don't have installation_id, so we'll just authenticate the user
      // and let them select an installation later
      const res = await fetch("/api/auth/test-callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (data.success) {
        setIsAuthenticated(true);
        setUserProfile(data.user);
        fetchInstallations();
      } else {
        setError("Authentication failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("OAuth callback failed:", err);
      setError("Authentication failed");
    } finally {
      setCheckingAuth(false);
    }
  }

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();

      if (data.authenticated) {
        setIsAuthenticated(true);
        setUserProfile(data.user);
        fetchInstallations();
      }
    } catch (err) {
      console.error("Auth check failed:", err);
    } finally {
      setCheckingAuth(false);
    }
  }

  async function fetchInstallations() {
    try {
      const res = await fetch("/api/user/installations");
      const data = await res.json();

      if (data.success) {
        setInstallations(data.installations);
      }
    } catch (err) {
      console.error("Failed to fetch installations:", err);
    }
  }

  function initiateGitHubLogin() {
    // Redirect to GitHub OAuth
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    const redirectUri = `${window.location.origin}/test`;
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user`;
  }

  async function validateKey() {
    if (!apiKey) {
      setError("Please enter an API key");
      return;
    }

    if (!apiKey.startsWith("sk-ant-")) {
      setError('API key should start with "sk-ant-". Get your key from console.anthropic.com');
      return;
    }

    const detectedKeyType = apiKey.includes("-oat") ? "oauth_token" : "api_key";

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/api-key/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, keyType: detectedKeyType }),
      });

      const data = await res.json();

      if (data.valid) {
        setIsValidated(true);
        setError(null);
      } else {
        setError(data.error || "Invalid API key");
      }
    } catch (err) {
      setError("Failed to validate API key");
    } finally {
      setIsLoading(false);
    }
  }

  async function testClaude() {
    if (!problem.trim()) {
      setError("Please enter a problem description");
      return;
    }

    const detectedKeyType = apiKey.includes("-oat") ? "oauth_token" : "api_key";

    // For OAuth tokens, trigger the workflow
    if (detectedKeyType === "oauth_token") {
      if (!repoName.trim()) {
        setError("Please enter a repository name (e.g., owner/repo)");
        return;
      }

      setIsLoading(true);
      setError(null);
      setResponse("");

      // For OAuth tokens, actually create the issue and trigger workflow
      try {
        const res = await fetch("/api/trigger-workflow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey,
            problemDescription: problem,
            repoFullName: repoName,
          }),
        });

        const data = await res.json();

        if (data.success) {
          setResponse(`🚀 Issue Created & Webhook Triggered!\n\nIssue: ${data.issueUrl}\n\nWhat's happening now:\n1. ✅ OAuth token saved to database\n2. ✅ GitHub issue created with @claude mention\n3. ⏳ Webhook detected the mention\n4. ⏳ Worker.yml is running with Claude CLI\n5. ⏳ PR will be created automatically\n\nCheck your repo's Actions tab to see the workflow running!`);
        } else {
          setError(data.error || "Failed to create issue");
        }
      } catch (err) {
        setError("Failed to create issue");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // For regular API keys, test directly
    setIsLoading(true);
    setError(null);
    setResponse("");

    try {
      const res = await fetch("/api/test-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, keyType: detectedKeyType, problemDescription: problem }),
      });

      const data = await res.json();

      if (data.success) {
        setResponse(data.response);
      } else {
        setError(data.error || "Test failed");
      }
    } catch (err) {
      setError("Failed to test Claude");
    } finally {
      setIsLoading(false);
    }
  }

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Checking authentication...</p>
        </div>
      </main>
    );
  }

  // Show setup instructions if not authenticated
  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white text-center">
            Test Claude Bot
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">
            To test Claude Bot, you need to install the GitHub App first
          </p>

          <div className="space-y-6">
            {/* Step 1 */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Install GitHub App
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                    Install the Claude Bot GitHub App on your repository
                  </p>
                  <a
                    href={`https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'self-healing-claude'}/installations/new`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Install App →
                  </a>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-600 text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Setup Your API Key
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                    After installation, you'll be redirected to the setup page to enter your Anthropic API key
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-600 text-white rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Come Back Here to Test
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Once setup is complete, return to this page to test creating PRs
                  </p>
                </div>
              </div>
            </div>

            {/* Or sign in if already installed */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 text-center">
                Already installed the app?
              </p>
              <button
                onClick={initiateGitHubLogin}
                className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Sign in with GitHub
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        {/* User Profile */}
        {userProfile && (
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            {userProfile.avatar_url && (
              <img
                src={userProfile.avatar_url}
                alt={userProfile.login}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {userProfile.login}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {installations.length} installation{installations.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}

        <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white text-center">
          Test Claude Bot
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">
          Test your Claude OAuth token and create PRs
        </p>

        {!isValidated ? (
          <>
            {/* Instructions */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Get your API key from:</strong>{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  console.anthropic.com/settings/keys
                </a>
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">
                Supports both API keys (sk-ant-api...) and Claude Code OAuth tokens (sk-ant-oat...)
              </p>
            </div>

            {/* API Key Input */}
            <div className="mb-6">
              <label
                htmlFor="apiKey"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                API Key or Token
              </label>
              <input
                type="password"
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              onClick={validateKey}
              disabled={isLoading || !apiKey}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Validating..." : "Validate API Key"}
            </button>
          </>
        ) : (
          <>
            <div className="mb-6 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">
                {apiKey.includes("-oat")
                  ? "OAuth token format is valid! This token will work with Claude Code CLI in GitHub workflows."
                  : "API Key validated successfully!"}
              </p>
            </div>

            {/* Show test section only for API keys, not OAuth tokens */}
            {!apiKey.includes("-oat") ? (
              <>
                {/* Problem Input */}
                <div className="mb-6">
                  <label
                    htmlFor="problem"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Problem Description
                  </label>
                  <textarea
                    id="problem"
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    placeholder="Describe a problem or bug you want Claude to help with..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                  />
                </div>

                {error && (
                  <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <button
                  onClick={testClaude}
                  disabled={isLoading || !problem.trim()}
                  className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? "Testing..." : "Test Claude"}
                </button>

                {response && (
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Claude's Response:
                    </h3>
                    <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {response}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
                    OAuth Token - Trigger Workflow
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    This will trigger the GitHub Actions workflow to create a PR using Claude CLI.
                  </p>
                </div>

                {/* Repository/Installation Selector */}
                <div className="mb-4">
                  <label
                    htmlFor="installation"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Select Repository
                  </label>
                  {installations.length > 0 ? (
                    <select
                      id="installation"
                      value={selectedInstallation?.account_login || ""}
                      onChange={(e) => {
                        const installation = installations.find(i => i.account_login === e.target.value);
                        setSelectedInstallation(installation || null);
                        setRepoName(e.target.value ? `${e.target.value}/${e.target.value}` : "");
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select an installation...</option>
                      {installations.map((installation) => (
                        <option key={installation.installation_id} value={installation.account_login}>
                          {installation.account_login} ({installation.account_type})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        No installations found. Please install the GitHub App on a repository first.
                      </p>
                      <a
                        href="https://github.com/apps/YOUR_APP_NAME/installations/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 underline"
                      >
                        Install GitHub App →
                      </a>
                    </div>
                  )}
                </div>

                {/* Manual repo input as fallback */}
                {selectedInstallation && (
                  <div className="mb-4">
                    <label
                      htmlFor="repoName"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Specific Repository (optional)
                    </label>
                    <input
                      type="text"
                      id="repoName"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder={`${selectedInstallation.account_login}/repo-name`}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}

                {/* Problem Input */}
                <div className="mb-4">
                  <label
                    htmlFor="problem"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Problem Description
                  </label>
                  <textarea
                    id="problem"
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    placeholder="Describe what needs to be fixed or implemented..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                  />
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <button
                  onClick={testClaude}
                  disabled={isLoading || !problem.trim() || !repoName.trim()}
                  className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? "Creating Issue & Triggering PR..." : "Create Issue & Trigger PR"}
                </button>

                {response && (
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Result:
                    </h3>
                    <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {response}
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              onClick={() => {
                setIsValidated(false);
                setApiKey("");
                setProblem("");
                setResponse("");
                setError(null);
              }}
              className="mt-4 w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-6 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Use Different API Key
            </button>
          </>
        )}

        <p className="mt-6 text-xs text-gray-500 dark:text-gray-400 text-center">
          This is a test page. Your API key is sent directly to Anthropic and is not stored.
        </p>
      </div>
    </main>
  );
}
