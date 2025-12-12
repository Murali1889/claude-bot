"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { createBrowserClient } from "@/lib/supabase";
import "./animations.css";

interface User {
  id: string;
  github_username: string;
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
  { key: "pending", label: "Queued", icon: "⏳" },
  { key: "rca_started", label: "Analyzing", icon: "🔍" },
  { key: "rca_completed", label: "RCA Done", icon: "📋" },
  { key: "documentation_checked", label: "Docs Ready", icon: "📚" },
  { key: "code_changes_started", label: "Coding", icon: "⚡" },
  { key: "code_changes_completed", label: "Code Done", icon: "✨" },
  { key: "pr_created", label: "PR Created", icon: "🎉" },
  { key: "completed", label: "Complete", icon: "✅" },
  { key: "failed", label: "Failed", icon: "❌" },
];

export default function JobsClient({ user }: Props) {
  const [jobs, setJobs] = useState<FixJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatedJobs, setUpdatedJobs] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: string }>>([]);

  useEffect(() => {
    fetchJobs();

    const supabase = createBrowserClient();
    const channel = supabase
      .channel('fix_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fix_jobs',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          handleRealtimeUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  useEffect(() => {
    fetchJobs();
  }, [statusFilter]);

  const handleRealtimeUpdate = (payload: any) => {
    const eventType = payload.eventType;
    const newJob = payload.new as FixJob;

    if (eventType === 'INSERT') {
      setJobs((prev) => [newJob, ...prev]);
      setUpdatedJobs((prev) => new Set(prev).add(newJob.id));
      showNotification(`New job created`, 'info');
      setTimeout(() => {
        setUpdatedJobs((prev) => {
          const next = new Set(prev);
          next.delete(newJob.id);
          return next;
        });
      }, 3000);
    } else if (eventType === 'UPDATE') {
      setJobs((prev) =>
        prev.map((job) => (job.id === newJob.id ? newJob : job))
      );
      setUpdatedJobs((prev) => new Set(prev).add(newJob.id));

      if (newJob.status === 'completed') {
        showNotification(`Job completed successfully`, 'success');
      } else if (newJob.status === 'failed') {
        showNotification(`Job failed`, 'error');
      }

      setTimeout(() => {
        setUpdatedJobs((prev) => {
          const next = new Set(prev);
          next.delete(newJob.id);
          return next;
        });
      }, 3000);
    }
  };

  const showNotification = (message: string, type: string) => {
    const notifId = `${Date.now()}`;
    setNotifications((prev) => [...prev, { id: notifId, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    }, 4000);
  };

  const fetchJobs = async () => {
    try {
      setError(null);
      const url = statusFilter === "all" ? "/api/fix/jobs" : `/api/fix/jobs?status=${statusFilter}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch jobs");
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getStageIndex = (status: string) => {
    return STATUS_STAGES.findIndex((s) => s.key === status);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-indigo-600 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Toast Notifications */}
      <div className="fixed top-20 right-4 z-50 space-y-2 max-w-md">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm animate-slide-in-right flex items-center gap-3 ${
              notif.type === 'success'
                ? 'bg-emerald-500/90 text-white'
                : notif.type === 'error'
                ? 'bg-rose-500/90 text-white'
                : 'bg-slate-800/90 text-white'
            }`}
          >
            <span className="text-lg">{notif.type === 'success' ? '✓' : notif.type === 'error' ? '✕' : 'ℹ'}</span>
            <p className="text-sm font-medium">{notif.message}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2 -mb-px overflow-x-auto">
          {[
            { key: "all", label: "All Jobs", count: jobs.length },
            { key: "running", label: "In Progress", count: 0 },
            { key: "completed", label: "Completed", count: 0 },
            { key: "failed", label: "Failed", count: 0 },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setStatusFilter(filter.key)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                statusFilter === filter.key
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs Grid */}
      {jobs.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No jobs yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create your first fix job to get started
          </p>
          <a
            href="/fix"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Create Fix Job
          </a>
        </div>
      ) : (
        <div className="grid gap-6">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isSelected={selectedJob === job.id}
              isUpdated={updatedJobs.has(job.id)}
              onSelect={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
              getStageIndex={getStageIndex}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Separate JobCard component for cleaner code
function JobCard({
  job,
  isSelected,
  isUpdated,
  onSelect,
  getStageIndex,
  formatDate,
}: {
  job: any;
  isSelected: boolean;
  isUpdated: boolean;
  onSelect: () => void;
  getStageIndex: (status: string) => number;
  formatDate: (date: string) => string;
}) {
  const currentStage = getStageIndex(job.status);
  const isActive = !['completed', 'failed'].includes(job.status);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border transition-all duration-300 ${
        isUpdated
          ? "border-indigo-500 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md"
      }`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {job.repository_full_name}
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(job.created_at)}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
              {job.problem_statement}
            </h3>
          </div>
          {job.pr_url && (
            <a
              href={job.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              View PR →
            </a>
          )}
        </div>

        {/* Progress Tracker */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            {STATUS_STAGES.filter(s => s.key !== 'failed').map((stage, idx) => {
              const isCompleted = idx < currentStage || job.status === 'completed';
              const isCurrent = idx === currentStage && isActive;
              const isFailed = job.status === 'failed';

              return (
                <div key={stage.key} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium transition-all mb-2 ${
                      isFailed
                        ? 'bg-rose-100 dark:bg-rose-900/20 text-rose-600'
                        : isCompleted
                        ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600'
                        : isCurrent
                        ? 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 animate-pulse'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    }`}
                  >
                    {isFailed ? '✕' : isCompleted ? '✓' : stage.icon}
                  </div>
                  <span
                    className={`text-xs font-medium text-center ${
                      isFailed
                        ? 'text-rose-600'
                        : isCompleted || isCurrent
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-400'
                    }`}
                  >
                    {stage.label}
                  </span>
                  {idx < STATUS_STAGES.length - 2 && (
                    <div
                      className={`hidden sm:block absolute h-0.5 w-full top-5 left-1/2 -z-10 transition-all ${
                        isCompleted ? 'bg-emerald-300' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                      style={{ width: 'calc(100% - 40px)' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Message */}
        {job.error_message && (
          <div className="mb-4 p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-rose-500 text-xl">⚠</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-rose-900 dark:text-rose-200 mb-1">
                  Error occurred
                </p>
                <p className="text-sm text-rose-700 dark:text-rose-300">
                  {job.error_message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Details Button */}
        <button
          onClick={onSelect}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {isSelected ? '↑ Hide Details' : '↓ View Details'}
        </button>
      </div>

      {/* Expanded Details */}
      {isSelected && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="p-6 space-y-6">
            {/* RCA Section */}
            {job.rca && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="text-indigo-600">📊</span>
                  Root Cause Analysis
                </h4>
                <div className="prose prose-sm prose-slate dark:prose-invert max-w-none bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <ReactMarkdown
                    components={{
                      h1: ({ node, ...props }) => <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2" {...props} />,
                      p: ({ node, ...props }) => <p className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 mb-3" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 space-y-1 mb-3" {...props} />,
                      code: ({ node, inline, ...props }: any) =>
                        inline ? (
                          <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-rose-600 dark:text-rose-400 rounded text-sm font-mono" {...props} />
                        ) : (
                          <code className="block p-3 bg-gray-900 text-gray-100 rounded-lg text-sm font-mono overflow-x-auto" {...props} />
                        ),
                    }}
                  >
                    {job.rca}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Files Changed */}
            {job.files_changed && job.files_changed.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="text-purple-600">📝</span>
                  Files Modified ({job.files_changed.length})
                </h4>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    {job.files_changed.map((file, index) => (
                      <div
                        key={index}
                        className="px-4 py-2 text-sm font-mono text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
