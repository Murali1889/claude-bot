"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type SetupStep = "loading" | "auth" | "setup" | "success" | "error" | "test";

function SetupContent() {
  const searchParams = useSearchParams();
  const installationId = searchParams.get("installation_id");

  const [step, setStep] = useState<SetupStep>("loading");
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [keyType, setKeyType] = useState<"api_key" | "oauth_token">("api_key");
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [githubUser, setGithubUser] = useState<{
    login: string;
    avatar_url: string;
  } | null>(null);
  const [testProblem, setTestProblem] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const oauthProcessed = useRef(false);

  // Check if user is authenticated and capture installation
  useEffect(() => {
    if (!installationId) {
      setStep("error");
      setError("Missing installation_id parameter");
      return;
    }

    // Check for GitHub OAuth callback (only process once)
    const code = searchParams.get("code");
    if (code && !oauthProcessed.current) {
      oauthProcessed.current = true;
      handleOAuthCallback(code);
    } else if (!code) {
      // Check if already authenticated (via cookie/session)
      checkAuthStatus();
    }
  }, [installationId]);

  // Capture installation in database when authenticated
  useEffect(() => {
    if (step === "setup" && installationId) {
      captureInstallation();
    }
  }, [step, installationId]);

  // Verify installation exists
  useEffect(() => {
    async function verifyInstallation() {
      if (!installationId) return;

      try {
        const res = await fetch(`/api/installation/verify?installation_id=${installationId}`);
        const data = await res.json();

        if (!data.exists) {
          setError("Installation not found. Please reinstall the GitHub App.");
          setStep("error");
        }
      } catch (err) {
        // Silently ignore - we'll catch this in other places
      }
    }

    verifyInstallation();
  }, [installationId]);

  async function checkAuthStatus() {
    try {
      const res = await fetch(`/api/auth/session?installation_id=${installationId}`);
      const data = await res.json();

      if (data.authenticated) {
        setGithubUser(data.user);
        setStep("setup");
      } else {
        setStep("auth");
      }
    } catch (err) {
      setStep("auth");
    }
  }

  async function captureInstallation() {
    try {
      const setupAction = searchParams.get("setup_action") || "install";

      const res = await fetch("/api/installations/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installation_id: installationId,
          setup_action: setupAction,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        console.error("Failed to capture installation:", data.error);
        // Don't show error to user - this is background operation
        // Installation will be captured via webhook as fallback
      } else {
        console.log("Installation captured successfully:", data.installation);
      }
    } catch (err) {
      console.error("Error capturing installation:", err);
      // Silently fail - webhook will handle it
    }
  }

  async function handleOAuthCallback(code: string) {
    setStep("loading");

    // Clean URL immediately to prevent re-using the code on refresh
    window.history.replaceState({}, "", `/setup?installation_id=${installationId}`);

    try {
      const res = await fetch("/api/auth/github/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, installation_id: installationId }),
      });

      const data = await res.json();

      if (data.success) {
        setGithubUser(data.user);
        setStep("setup");
      } else {
        // If code expired/invalid, check if user is already authenticated
        if (data.error?.includes("incorrect or expired")) {
          // Try checking session - user might already be logged in
          checkAuthStatus();
        } else {
          setError(data.error || "Authentication failed");
          setStep("error");
        }
      }
    } catch (err) {
      setError("Authentication failed");
      setStep("error");
    }
  }

  function initiateGitHubAuth() {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    const redirectUri = `${window.location.origin}/setup?installation_id=${installationId}`;
    const scope = "read:user";

    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
  }

  async function validateApiKey() {
    setIsValidating(true);
    setError(null);

    try {
      const res = await fetch("/api/api-key/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, keyType }),
      });

      const data = await res.json();

      if (!data.valid) {
        setError(data.error || "Invalid API key");
        setIsValidating(false);
        return false;
      }

      setIsValidating(false);
      return true;
    } catch (err) {
      setError("Failed to validate API key");
      setIsValidating(false);
      return false;
    }
  }

  async function handleTestClaude() {
    if (!testProblem.trim()) {
      setError("Please enter a problem description");
      return;
    }

    setIsTesting(true);
    setError(null);
    setTestResponse("");

    try {
      const res = await fetch("/api/test-claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId,
          problemDescription: testProblem,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setTestResponse(data.response);
      } else {
        setError(data.error || "Test failed");
      }
    } catch (err) {
      setError("Failed to test Claude");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate format
    if (keyType === "api_key" && !apiKey.startsWith("sk-ant-")) {
      setError('API key should start with "sk-ant-"');
      return;
    }

    // Validate with Anthropic
    const isValid = await validateApiKey();
    if (!isValid) return;

    // Save the key
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId,
          apiKey,
          keyType,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setStep("success");
      } else {
        setError(data.error || "Failed to save API key");
      }
    } catch (err) {
      setError("Failed to save API key");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Loading state
  if (step === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </main>
    );
  }

  // Error state
  if (step === "error") {
    const isInstallationError = error?.includes("Installation not found") || error?.includes("not found");

    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Setup Error
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>

          {isInstallationError ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                The GitHub App installation was not found in our system. This usually means the webhook wasn't received properly.
              </p>
              <a
                href="https://github.com/apps/self-healing-claude/installations/new"
                className="inline-block w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Reinstall GitHub App
              </a>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-6 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => {
                  setError(null);
                  setStep("auth");
                }}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <a
                href="/"
                className="inline-block w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-6 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Go Home
              </a>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Auth required state
  if (step === "auth") {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Verify Your Identity
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Please sign in with GitHub to verify you own this installation.
          </p>
          <button
            onClick={initiateGitHubAuth}
            className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Sign in with GitHub
          </button>
        </div>
      </main>
    );
  }

  // Success state
  if (step === "success") {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="text-green-500 text-5xl mb-4">&#10003;</div>
            <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              Setup Complete!
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Your API key has been saved. You can now use @claude in your GitHub
              issues to get AI-powered fixes.
            </p>
          </div>

          {/* Test Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Test Claude
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Enter a problem description to test if your API key is working:
            </p>

            <textarea
              value={testProblem}
              onChange={(e) => setTestProblem(e.target.value)}
              placeholder="Describe a problem or bug you want Claude to help with... e.g., 'How do I fix a null pointer exception in Java?'"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
            />

            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              onClick={handleTestClaude}
              disabled={isTesting || !testProblem.trim()}
              className="mt-4 w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isTesting ? "Testing..." : "Test Claude"}
            </button>

            {testResponse && (
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Claude's Response:
                </h3>
                <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {testResponse}
                </div>
              </div>
            )}
          </div>

          {/* Usage Instructions */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-left">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                Use in GitHub issues:
              </p>
              <code className="text-sm text-gray-800 dark:text-gray-200">
                @claude fix this bug
              </code>
            </div>
            <div className="mt-4 text-center">
              <a
                href="https://github.com"
                className="inline-block bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-2 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
              >
                Go to GitHub
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Setup form
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        {githubUser && (
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <img
              src={githubUser.avatar_url}
              alt={githubUser.login}
              className="w-10 h-10 rounded-full"
            />
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {githubUser.login}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Installation #{installationId}
              </p>
            </div>
          </div>
        )}

        <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
          Configure API Key
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Enter your Anthropic API key or Claude Code token to enable Claude Bot.
        </p>

        {/* Key Type Selector */}
        <div className="mb-6">
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="keyType"
                value="api_key"
                checked={keyType === "api_key"}
                onChange={() => setKeyType("api_key")}
                className="mr-2"
              />
              <span className="text-gray-700 dark:text-gray-300">
                Anthropic API Key
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="keyType"
                value="oauth_token"
                checked={keyType === "oauth_token"}
                onChange={() => setKeyType("oauth_token")}
                className="mr-2"
              />
              <span className="text-gray-700 dark:text-gray-300">
                Claude Code Token
              </span>
            </label>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
          {keyType === "api_key" ? (
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-semibold mb-2">Get your API key:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  Go to{" "}
                  <a
                    href="https://console.anthropic.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    console.anthropic.com
                  </a>
                </li>
                <li>Navigate to API Keys</li>
                <li>Create a new key or copy an existing one</li>
              </ol>
            </div>
          ) : (
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-semibold mb-2">Get your Claude Code token:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  Install Claude Code:{" "}
                  <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
                    npm install -g @anthropic-ai/claude-code
                  </code>
                </li>
                <li>
                  Run:{" "}
                  <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
                    claude setup-token
                  </code>
                </li>
                <li>Copy the generated token</li>
              </ol>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label
              htmlFor="apiKey"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {keyType === "api_key" ? "API Key" : "OAuth Token"}
            </label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                keyType === "api_key" ? "sk-ant-api03-..." : "Enter token..."
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isValidating || isSubmitting || !apiKey}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isValidating
              ? "Validating..."
              : isSubmitting
              ? "Saving..."
              : "Save API Key"}
          </button>
        </form>

        <p className="mt-6 text-xs text-gray-500 dark:text-gray-400 text-center">
          Your API key is encrypted and stored securely. It will only be used to
          process your @claude requests.
        </p>
      </div>
    </main>
  );
}

// Loading fallback for Suspense
function SetupLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Loading...</p>
      </div>
    </main>
  );
}

// Main page component with Suspense boundary
export default function SetupPage() {
  return (
    <Suspense fallback={<SetupLoading />}>
      <SetupContent />
    </Suspense>
  );
}
