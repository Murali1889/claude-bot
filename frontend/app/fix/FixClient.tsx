"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  github_user_id: number;
  github_username: string;
  email: string | null;
  avatar_url: string | null;
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
}

interface Installation {
  id: number;
  account: {
    login: string;
    type: string;
    avatar_url: string;
  };
  repositories?: Repository[];
}

interface FixJob {
  id: string;
  repository_full_name: string;
  problem_statement: string;
  status: string;
  pr_url?: string;
  pr_number?: number;
  error_message?: string;
  created_at: string;
}

interface Props {
  user: User;
}

export default function FixClient({ user }: Props) {
  const router = useRouter();

  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState<number | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [problemStatement, setProblemStatement] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<FixJob | null>(null);

  // Fetch installations and repositories
  useEffect(() => {
    fetchInstallations();
  }, []);

  // Fetch repositories when installation is selected
  useEffect(() => {
    if (selectedInstallation) {
      fetchRepositories(selectedInstallation);
    }
  }, [selectedInstallation]);

  const fetchInstallations = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/installations");
      const data = await response.json();

      if (data.installations && data.installations.length > 0) {
        setInstallations(data.installations);
        // Auto-select first installation
        setSelectedInstallation(data.installations[0].id);
      } else {
        setError("No installations found. Please install the GitHub App first.");
      }
    } catch (err) {
      setError("Failed to load installations");
    } finally {
      setLoading(false);
    }
  };

  const fetchRepositories = async (installationId: number) => {
    try {
      const response = await fetch(
        `/api/installations/${installationId}/repositories`
      );
      const data = await response.json();

      // Update the installation with repositories
      setInstallations((prev) =>
        prev.map((inst) =>
          inst.id === installationId
            ? { ...inst, repositories: data.repositories || [] }
            : inst
        )
      );
    } catch (err) {
      console.error("Error fetching repositories:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCurrentJob(null);

    if (!selectedRepo) {
      setError("Please select a repository");
      return;
    }

    if (!problemStatement.trim()) {
      setError("Please enter a problem statement");
      return;
    }

    setSubmitting(true);

    try {
      const [repoId, repoFullName] = selectedRepo.split("|");

      const response = await fetch("/api/fix/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installation_id: selectedInstallation,
          repository_id: parseInt(repoId),
          repository_full_name: repoFullName,
          problem_statement: problemStatement,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit fix request");
      }

      // Start polling for job status
      setCurrentJob(data.job);
      pollJobStatus(data.job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
      setSubmitting(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/fix/status/${jobId}`);
        const data = await response.json();

        setCurrentJob(data.job);

        // Stop polling if completed or failed
        if (data.job.status === "completed" || data.job.status === "failed") {
          setSubmitting(false);
          return;
        }

        // Continue polling every 3 seconds
        setTimeout(poll, 3000);
      } catch (err) {
        console.error("Error polling job status:", err);
        setSubmitting(false);
      }
    };

    poll();
  };

  const currentInstallation = installations.find(
    (inst) => inst.id === selectedInstallation
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (installations.length === 0) {
    return (
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
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No GitHub App installations
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Please install the GitHub App on your repositories first.
        </p>
        <a
          href="/dashboard"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Go to Dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Submission Form */}
      {!currentJob && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Installation Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Installation
              </label>
              <select
                value={selectedInstallation || ""}
                onChange={(e) => {
                  setSelectedInstallation(Number(e.target.value));
                  setSelectedRepo(""); // Reset repo selection
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                required
              >
                {installations.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.account.login} ({inst.account.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Repository Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Repository
              </label>
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                required
                disabled={!currentInstallation?.repositories}
              >
                <option value="">Select a repository...</option>
                {currentInstallation?.repositories?.map((repo) => (
                  <option key={repo.id} value={`${repo.id}|${repo.full_name}`}>
                    {repo.name}
                    {repo.private && " 🔒"}
                  </option>
                ))}
              </select>
              {currentInstallation && !currentInstallation.repositories && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Loading repositories...
                </p>
              )}
            </div>

            {/* Problem Statement */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Problem Statement
              </label>
              <textarea
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                placeholder="Describe the bug or feature you want Claude to fix...&#10;&#10;Example:&#10;- Fix null pointer exception in UserService&#10;- Add error handling to API endpoints&#10;- Refactor authentication logic"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                rows={8}
                required
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Be specific about what you want Claude to fix or improve.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !selectedRepo || !problemStatement.trim()}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                "Create Fix"
              )}
            </button>
          </form>
        </div>
      )}

      {/* Execution Status */}
      {currentJob && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {currentJob.repository_full_name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {currentJob.problem_statement}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  currentJob.status === "completed"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                    : currentJob.status === "failed"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                    : currentJob.status === "running"
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                    : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                }`}
              >
                {currentJob.status}
              </span>
            </div>

            {/* Progress Steps */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  currentJob.status !== "pending"
                    ? "bg-green-500 text-white"
                    : "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400"
                }`}>
                  {currentJob.status !== "pending" ? "✓" : "1"}
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Queued for execution
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  currentJob.status === "running" || currentJob.status === "completed"
                    ? "bg-green-500 text-white"
                    : currentJob.status === "failed"
                    ? "bg-red-500 text-white"
                    : "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400"
                }`}>
                  {currentJob.status === "running" ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : currentJob.status === "completed" ? (
                    "✓"
                  ) : currentJob.status === "failed" ? (
                    "✗"
                  ) : (
                    "2"
                  )}
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Running Claude Code CLI
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  currentJob.status === "completed"
                    ? "bg-green-500 text-white"
                    : "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400"
                }`}>
                  {currentJob.status === "completed" ? "✓" : "3"}
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Creating pull request
                </span>
              </div>
            </div>

            {/* Success */}
            {currentJob.status === "completed" && currentJob.pr_url && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
                  ✅ Pull Request Created!
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                  PR #{currentJob.pr_number} has been created with the fixes.
                </p>
                <div className="flex gap-3">
                  <a
                    href={currentJob.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    View Pull Request
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <button
                    onClick={() => {
                      setCurrentJob(null);
                      setProblemStatement("");
                      setSelectedRepo("");
                    }}
                    className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium"
                  >
                    Create Another Fix
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {currentJob.status === "failed" && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                  ❌ Fix Failed
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                  {currentJob.error_message || "An error occurred while processing your request."}
                </p>
                <button
                  onClick={() => setCurrentJob(null)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Card */}
      {!currentJob && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">
            💡 How it works
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-300">
            <li>Select the repository you want to fix</li>
            <li>Describe the problem or feature request</li>
            <li>Claude Code CLI analyzes your codebase</li>
            <li>Generates fixes and creates a pull request</li>
            <li>Review and merge the PR on GitHub</li>
          </ol>
        </div>
      )}
    </div>
  );
}
