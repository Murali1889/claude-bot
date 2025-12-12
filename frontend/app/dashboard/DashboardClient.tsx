"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { createBrowserClient } from "@/lib/supabase";

interface User {
  id: string;
  github_user_id: number;
  github_username: string;
  email: string | null;
  avatar_url: string | null;
}

interface FixJob {
  id: string;
  repository_full_name: string;
  problem_statement: string;
  status: string;
  rca: string | null;
  codebase_documentation: string | null;
  pr_url: string | null;
  pr_number: number | null;
  branch_name: string | null;
  files_changed: string[] | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface Props {
  user: User;
}

const STATUS_STAGES = [
  { key: "pending", label: "Queue" },
  { key: "rca_started", label: "Analyze" },
  { key: "rca_completed", label: "RCA" },
  { key: "documentation_checked", label: "Docs" },
  { key: "code_changes_started", label: "Code" },
  { key: "code_changes_completed", label: "Done" },
  { key: "pr_created", label: "PR" },
  { key: "completed", label: "Complete" },
];

export default function DashboardClient({ user }: Props) {
  const [jobs, setJobs] = useState<FixJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [updatedJobs, setUpdatedJobs] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchJobs();
    const supabase = createBrowserClient();
    const channel = supabase
      .channel("fix_jobs_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fix_jobs",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => handleRealtimeUpdate(payload)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const handleRealtimeUpdate = (payload: any) => {
    const newJob = payload.new as FixJob;
    if (payload.eventType === "INSERT") {
      setJobs((prev) => [newJob, ...prev]);
      setUpdatedJobs((prev) => new Set(prev).add(newJob.id));
      setTimeout(() => {
        setUpdatedJobs((prev) => {
          const next = new Set(prev);
          next.delete(newJob.id);
          return next;
        });
      }, 3000);
    } else if (payload.eventType === "UPDATE") {
      setJobs((prev) =>
        prev.map((job) => (job.id === newJob.id ? newJob : job))
      );
      setUpdatedJobs((prev) => new Set(prev).add(newJob.id));
      setTimeout(() => {
        setUpdatedJobs((prev) => {
          const next = new Set(prev);
          next.delete(newJob.id);
          return next;
        });
      }, 3000);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await fetch("/api/fix/jobs");
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (err) {
      console.error("Error fetching jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStageIndex = (status: string) =>
    STATUS_STAGES.findIndex((s) => s.key === status);

  if (loading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-indigo-600"></div>
      </div>
    );
  }

  const runningJobs = jobs.filter(
    (j) => !["completed", "failed"].includes(j.status)
  );
  const completedJobs = jobs.filter(
    (j) => j.status === "completed"
  );
  const failedJobs = jobs.filter((j) => j.status === "failed");

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Running Jobs
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {runningJobs.length}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Completed
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {completedJobs.length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Failed
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {failedJobs.length}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Recent Jobs
          </h2>
          <a
            href="/fix"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <svg
              className="w-4 h-4"
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
            Create Fix
          </a>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No jobs yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first fix job to get started
            </p>
            <a
              href="/fix"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Create Fix
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.slice(0, 5).map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isSelected={selectedJob === job.id}
                isUpdated={updatedJobs.has(job.id)}
                onSelect={() =>
                  setSelectedJob(selectedJob === job.id ? null : job.id)
                }
                getStageIndex={getStageIndex}
              />
            ))}
            {jobs.length > 5 && (
              <div className="text-center pt-4">
                <a
                  href="/jobs"
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                >
                  View all {jobs.length} jobs →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function JobCard({
  job,
  isSelected,
  isUpdated,
  onSelect,
  getStageIndex,
}: any) {
  const isFinished = ["completed", "failed"].includes(job.status);

  // For completed jobs: Two-column layout
  if (isFinished) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg border transition-all duration-300 ${
          isUpdated
            ? "border-indigo-400 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
            : "border-gray-200 dark:border-gray-700 hover:shadow-md"
        }`}
      >
        <div className="grid md:grid-cols-2 gap-4 p-4">
          {/* Left: RCA & Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div
                className={`px-2 py-1 rounded text-xs font-medium ${
                  job.status === "completed"
                    ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                    : "bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400"
                }`}
              >
                {job.status === "completed" ? "✓ Completed" : "✕ Failed"}
              </div>
              {job.pr_url && (
                <a
                  href={job.pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 transition-colors"
                >
                  View PR →
                </a>
              )}
            </div>

            {job.rca && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Root Cause Analysis
                </h4>
                <div className="prose prose-sm prose-slate dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-900/50 rounded p-3 text-xs max-h-64 overflow-y-auto">
                  <ReactMarkdown>{job.rca}</ReactMarkdown>
                </div>
              </div>
            )}

            {job.files_changed && job.files_changed.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Files Changed ({job.files_changed.length})
                </h4>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded overflow-hidden max-h-32 overflow-y-auto">
                  {job.files_changed.map((file: string, i: number) => (
                    <div
                      key={i}
                      className="px-3 py-1.5 text-xs font-mono text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 last:border-0"
                    >
                      {file}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {job.error_message && (
              <div className="p-2 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded text-xs text-rose-700 dark:text-rose-300">
                {job.error_message}
              </div>
            )}
          </div>

          {/* Right: Problem Statement */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {job.repository_full_name}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Problem Statement
              </h4>
              <p className="text-sm text-gray-900 dark:text-white leading-relaxed">
                {job.problem_statement}
              </p>
            </div>

            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Created</span>
                <span>{new Date(job.created_at).toLocaleString()}</span>
              </div>
              {job.completed_at && (
                <div className="flex justify-between">
                  <span>Completed</span>
                  <span>{new Date(job.completed_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // For in-progress jobs: Simple layout
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border transition-all duration-300 ${
        isUpdated
          ? "border-indigo-400 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
          : "border-gray-200 dark:border-gray-700 hover:shadow-md"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {job.repository_full_name}
              </span>
              <div
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  job.status === "pending"
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    : job.status.includes("rca")
                    ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                    : job.status.includes("code")
                    ? "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                    : job.status.includes("pr")
                    ? "bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400"
                    : "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400"
                }`}
              >
                {STATUS_STAGES.find((s) => s.key === job.status)?.label ||
                  job.status}
              </div>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {job.problem_statement}
            </h3>
          </div>
        </div>

        {job.error_message && (
          <div className="mb-3 p-2 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded text-xs text-rose-700 dark:text-rose-300">
            {job.error_message}
          </div>
        )}

        {job.rca && (
          <button
            onClick={onSelect}
            className="w-full py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {isSelected ? "Hide RCA ↑" : "View RCA ↓"}
          </button>
        )}
      </div>

      {isSelected && job.rca && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
          <div className="prose prose-sm prose-slate dark:prose-invert max-w-none bg-white dark:bg-gray-800 rounded p-3 text-xs">
            <ReactMarkdown>{job.rca}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
