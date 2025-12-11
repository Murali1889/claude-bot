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
    id: number;
  };
  repository_selection: "all" | "selected";
  created_at: string;
  updated_at: string;
  suspended_at: string | null;
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  updated_at: string;
}

interface Props {
  user: User;
}

export default function DashboardClient({ user }: Props) {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [repositories, setRepositories] = useState<Record<number, Repository[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingRepos, setLoadingRepos] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [expandedInstallations, setExpandedInstallations] = useState<Set<number>>(new Set());

  // Fetch installations on mount
  useEffect(() => {
    fetchInstallations();
  }, []);

  const fetchInstallations = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/installations");

      if (!response.ok) {
        throw new Error("Failed to fetch installations");
      }

      const data = await response.json();
      setInstallations(data.installations || []);

      // Auto-expand and fetch repos for the first installation
      if (data.installations && data.installations.length > 0) {
        const firstInstallationId = data.installations[0].id;
        setExpandedInstallations(new Set([firstInstallationId]));
        fetchRepositories(firstInstallationId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchRepositories = async (installationId: number) => {
    if (repositories[installationId]) {
      // Already fetched
      return;
    }

    try {
      setLoadingRepos((prev) => ({ ...prev, [installationId]: true }));

      const response = await fetch(
        `/api/installations/${installationId}/repositories`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch repositories");
      }

      const data = await response.json();
      setRepositories((prev) => ({
        ...prev,
        [installationId]: data.repositories || [],
      }));
    } catch (err) {
      console.error("Error fetching repositories:", err);
    } finally {
      setLoadingRepos((prev) => ({ ...prev, [installationId]: false }));
    }
  };

  const toggleInstallation = (installationId: number) => {
    const newExpanded = new Set(expandedInstallations);

    if (newExpanded.has(installationId)) {
      newExpanded.delete(installationId);
    } else {
      newExpanded.add(installationId);
      // Fetch repositories when expanding
      if (!repositories[installationId]) {
        fetchRepositories(installationId);
      }
    }

    setExpandedInstallations(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
          Error loading installations
        </h3>
        <p className="text-red-600 dark:text-red-300">{error}</p>
        <button
          onClick={fetchInstallations}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Installation Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              GitHub App Installations
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {installations.length === 0
                ? "No installations found. Install the GitHub App to get started."
                : `You have ${installations.length} installation${installations.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <a
            href="https://github.com/apps/self-healing-claude/installations/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Install GitHub App
          </a>
        </div>
      </div>

      {/* Installations List */}
      {installations.length > 0 && (
        <div className="space-y-4">
          {installations.map((installation) => (
            <div
              key={installation.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden"
            >
              {/* Installation Header */}
              <button
                onClick={() => toggleInstallation(installation.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={installation.account.avatar_url}
                    alt={installation.account.login}
                    className="w-12 h-12 rounded-full"
                  />
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {installation.account.login}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {installation.account.type} •{" "}
                      {installation.repository_selection === "all"
                        ? "All repositories"
                        : "Selected repositories"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {installation.suspended_at && (
                    <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs font-medium rounded-full">
                      Suspended
                    </span>
                  )}
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedInstallations.has(installation.id)
                        ? "transform rotate-180"
                        : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Repositories List */}
              {expandedInstallations.has(installation.id) && (
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
                  {loadingRepos[installation.id] ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  ) : repositories[installation.id]?.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Repositories ({repositories[installation.id].length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {repositories[installation.id].map((repo) => (
                          <a
                            key={repo.id}
                            href={repo.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
                          >
                            <svg
                              className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                  {repo.name}
                                </p>
                                {repo.private && (
                                  <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded">
                                    Private
                                  </span>
                                )}
                              </div>
                              {repo.description && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
                                  {repo.description}
                                </p>
                              )}
                              {repo.language && (
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                  {repo.language}
                                </p>
                              )}
                            </div>
                            <svg
                              className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                      No repositories found for this installation.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No Installations State */}
      {installations.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
          <svg
            className="w-16 h-16 text-gray-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No GitHub App installations
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Install the Claude Bot GitHub App on your repositories to enable
            AI-powered code fixes.
          </p>
          <a
            href="https://github.com/apps/self-healing-claude/installations/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Install GitHub App
          </a>
        </div>
      )}
    </div>
  );
}
