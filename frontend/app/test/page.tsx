"use client";

import { useState } from "react";

export default function TestPage() {
  const [apiKey, setApiKey] = useState("");
  const [keyType, setKeyType] = useState<"api_key" | "oauth_token">("api_key");
  const [problem, setProblem] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidated, setIsValidated] = useState(false);

  async function validateKey() {
    if (!apiKey) {
      setError("Please enter an API key");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/api-key/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, keyType }),
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

    setIsLoading(true);
    setError(null);
    setResponse("");

    try {
      const res = await fetch("/api/test-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, keyType, problemDescription: problem }),
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

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white text-center">
          Test Claude API
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">
          Test your Anthropic API key directly without installation
        </p>

        {!isValidated ? (
          <>
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

            {/* API Key Input */}
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
                API Key validated successfully!
              </p>
            </div>

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
