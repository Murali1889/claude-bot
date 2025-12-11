"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  github_user_id: number;
  github_username: string;
  email: string | null;
  avatar_url: string | null;
}

interface Installation {
  id: number;
  account: {
    login: string;
    type: string;
    avatar_url: string;
  };
  token_status?: {
    has_token: boolean;
    token_type?: string;
    key_prefix?: string;
  };
}

interface TokenInfo {
  installation_id: number;
  key_prefix: string;
  token_type: string;
  key_status: string;
  last_validated_at: string;
}

interface Props {
  user: User;
}

export default function SettingsClient({ user }: Props) {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [tokens, setTokens] = useState<Record<number, TokenInfo>>({});
  const [loading, setLoading] = useState(true);
  const [selectedInstallation, setSelectedInstallation] = useState<number | null>(null);

  // Form state
  const [token, setToken] = useState("");
  const [tokenType, setTokenType] = useState<"claude_code_token" | "anthropic_api_key">(
    "claude_code_token"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch installations and tokens
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch installations
      const installResp = await fetch("/api/installations");
      const installData = await installResp.json();

      // Fetch token status
      const tokenResp = await fetch("/api/tokens/save");
      const tokenData = await tokenResp.json();

      setInstallations(installData.installations || []);

      // Create map of installation_id => token info
      const tokenMap: Record<number, TokenInfo> = {};
      (tokenData.tokens || []).forEach((t: TokenInfo) => {
        tokenMap[t.installation_id] = t;
      });
      setTokens(tokenMap);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedInstallation) {
      setError("Please select an installation");
      return;
    }

    if (!token.trim()) {
      setError("Please enter a token");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/tokens/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installation_id: selectedInstallation,
          token,
          token_type: tokenType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save token");
      }

      setSuccess("Token saved successfully!");
      setToken("");

      // Refresh token list
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save token");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Token Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Claude Code Token
        </h2>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Enter your Claude Code CLI token to enable automated code fixes. Get your token by running:
        </p>

        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-6">
          <code className="text-sm text-gray-800 dark:text-gray-200">
            $ claude setup-token
          </code>
        </div>

        <form onSubmit={handleSaveToken} className="space-y-6">
          {/* Installation Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Installation
            </label>
            <select
              value={selectedInstallation || ""}
              onChange={(e) => setSelectedInstallation(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Choose installation...</option>
              {installations.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.account.login} ({inst.account.type})
                  {tokens[inst.id] && ` ✓ Token configured`}
                </option>
              ))}
            </select>
            {installations.length === 0 && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                No installations found.{" "}
                <a href="/dashboard" className="text-blue-600 hover:underline">
                  Install GitHub App
                </a>
              </p>
            )}
          </div>

          {/* Token Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Token Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="token_type"
                  value="claude_code_token"
                  checked={tokenType === "claude_code_token"}
                  onChange={() => setTokenType("claude_code_token")}
                  className="mr-3"
                />
                <div>
                  <span className="text-gray-900 dark:text-white font-medium">
                    Claude Code CLI Token
                  </span>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Recommended - OAuth token from Claude Code CLI
                  </p>
                </div>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="token_type"
                  value="anthropic_api_key"
                  checked={tokenType === "anthropic_api_key"}
                  onChange={() => setTokenType("anthropic_api_key")}
                  className="mr-3"
                />
                <div>
                  <span className="text-gray-900 dark:text-white font-medium">
                    Anthropic API Key
                  </span>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Alternative - Direct API key from console.anthropic.com
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Token Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {tokenType === "claude_code_token" ? "Claude Code Token" : "API Key"}
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={
                tokenType === "claude_code_token"
                  ? "Paste your Claude Code token..."
                  : "sk-ant-api03-..."
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              🔒 Your token is encrypted using AES-256-GCM before storage
            </p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving || !selectedInstallation}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save Token"}
          </button>
        </form>
      </div>

      {/* Configured Tokens */}
      {Object.keys(tokens).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Configured Tokens
          </h3>
          <div className="space-y-3">
            {Object.values(tokens).map((tokenInfo) => {
              const installation = installations.find((i) => i.id === tokenInfo.installation_id);
              return (
                <div
                  key={tokenInfo.installation_id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {installation?.account.login || "Unknown"}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {tokenInfo.key_prefix} •{" "}
                      {tokenInfo.token_type === "claude_code_token"
                        ? "Claude Code Token"
                        : "API Key"}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      tokenInfo.key_status === "active"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                        : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                    }`}
                  >
                    {tokenInfo.key_status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3">
          How to get your Claude Code token
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-300">
          <li>
            Install Claude Code CLI:{" "}
            <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">
              npm install -g @anthropic-ai/claude-code
            </code>
          </li>
          <li>
            Run the setup command:{" "}
            <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">
              claude setup-token
            </code>
          </li>
          <li>Follow the OAuth flow in your browser</li>
          <li>Copy the generated token</li>
          <li>Paste it in the form above</li>
        </ol>
      </div>
    </div>
  );
}
