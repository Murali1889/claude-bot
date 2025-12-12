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
  { key: "pending", label: "Queue" },
  { key: "rca_started", label: "Analyze" },
  { key: "rca_completed", label: "RCA" },
  { key: "documentation_checked", label: "Docs" },
  { key: "code_changes_started", label: "Code" },
  { key: "code_changes_completed", label: "Done" },
  { key: "pr_created", label: "PR" },
  { key: "completed", label: "Complete" },
];

export default function JobsClient({ user }: Props) {
  const [jobs, setJobs] = useState<FixJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatedJobs, setUpdatedJobs] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: string }>>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [demoJob, setDemoJob] = useState<FixJob | null>(null);

  useEffect(() => {
    fetchJobs();
    const supabase = createBrowserClient();
    const channel = supabase.channel('fix_jobs_changes').on('postgres_changes', {
      event: '*', schema: 'public', table: 'fix_jobs', filter: `user_id=eq.${user.id}`,
    }, (payload) => handleRealtimeUpdate(payload)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user.id]);

  useEffect(() => { fetchJobs(); }, [statusFilter]);

  const handleRealtimeUpdate = (payload: any) => {
    const newJob = payload.new as FixJob;
    if (payload.eventType === 'INSERT') {
      setJobs((prev) => [newJob, ...prev]);
      setUpdatedJobs((prev) => new Set(prev).add(newJob.id));
      showNotification('New job created', 'info');
      setTimeout(() => setUpdatedJobs((prev) => { const next = new Set(prev); next.delete(newJob.id); return next; }), 3000);
    } else if (payload.eventType === 'UPDATE') {
      setJobs((prev) => prev.map((job) => (job.id === newJob.id ? newJob : job)));
      setUpdatedJobs((prev) => new Set(prev).add(newJob.id));
      if (newJob.status === 'completed') showNotification('Job completed!', 'success');
      else if (newJob.status === 'failed') showNotification('Job failed', 'error');
      setTimeout(() => setUpdatedJobs((prev) => { const next = new Set(prev); next.delete(newJob.id); return next; }), 3000);
    }
  };

  const showNotification = (message: string, type: string) => {
    const notifId = `${Date.now()}`;
    setNotifications((prev) => [...prev, { id: notifId, message, type }]);
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== notifId)), 3000);
  };

  const startDemo = () => {
    const demo: FixJob = {
      id: 'demo', repository_full_name: 'demo/repo', problem_statement: 'Fix authentication bug',
      status: 'pending', rca: null, codebase_documentation: null, pr_url: null, pr_number: null,
      branch_name: null, files_changed: null, error_message: null,
      created_at: new Date().toISOString(), started_at: null, completed_at: null,
    };
    setDemoJob(demo);
    setDemoMode(true);
    setSelectedJob('demo');
    showNotification('Demo started!', 'info');

    const stages = [
      { status: 'rca_started', delay: 1500, msg: 'Analyzing...' },
      { status: 'rca_completed', delay: 3000, msg: 'RCA done', rca: '## Problem\nAuth bug\n\n## Solution\nFix session' },
      { status: 'documentation_checked', delay: 4500, msg: 'Docs ready' },
      { status: 'code_changes_started', delay: 6000, msg: 'Coding...' },
      { status: 'code_changes_completed', delay: 8000, msg: 'Code done', files: ['auth.ts', 'session.ts'] },
      { status: 'pr_created', delay: 9500, msg: 'PR created!', pr: '#123' },
      { status: 'completed', delay: 11000, msg: 'Complete!' },
    ];

    stages.forEach((s) => {
      setTimeout(() => {
        setDemoJob((p) => p ? { ...p, status: s.status, rca: s.rca || p.rca, files_changed: s.files || p.files_changed, pr_url: s.pr || p.pr_url } : null);
        setUpdatedJobs(new Set(['demo']));
        showNotification(s.msg, s.status === 'completed' ? 'success' : 'info');
        setTimeout(() => setUpdatedJobs(new Set()), 1500);
      }, s.delay);
    });

    setTimeout(() => {
      showNotification('Demo complete!', 'success');
      setTimeout(() => { setDemoMode(false); setDemoJob(null); setSelectedJob(null); }, 3000);
    }, 13000);
  };

  const fetchJobs = async () => {
    try {
      const url = statusFilter === "all" ? "/api/fix/jobs" : `/api/fix/jobs?status=${statusFilter}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const getStageIndex = (status: string) => STATUS_STAGES.findIndex((s) => s.key === status);

  if (loading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-indigo-600"></div>
      </div>
    );
  }

  const allJobs = demoJob ? [demoJob, ...jobs] : jobs;

  return (
    <div className="space-y-4">
      {/* Notifications */}
      <div className="fixed top-20 right-4 z-50 space-y-2">
        {notifications.map((n) => (
          <div key={n.id} className={`px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm animate-slide-in-right flex items-center gap-2 text-sm font-medium ${
            n.type === 'success' ? 'bg-emerald-500 text-white' : n.type === 'error' ? 'bg-rose-500 text-white' : 'bg-slate-700 text-white'
          }`}>
            <span>{n.type === 'success' ? '✓' : n.type === 'error' ? '✕' : '•'}</span>
            {n.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {["all", "running", "completed", "failed"].map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                statusFilter === f ? "bg-indigo-600 text-white shadow-md" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {!demoMode && (
          <button onClick={startDemo}
            className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:shadow-lg transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Demo
          </button>
        )}
      </div>

      {/* Jobs */}
      {allJobs.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-4xl mb-2">📋</div>
          <p className="text-sm text-gray-600 dark:text-gray-400">No jobs yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allJobs.map((job) => (
            <JobCard key={job.id} job={job} isSelected={selectedJob === job.id}
              isUpdated={updatedJobs.has(job.id)} onSelect={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
              getStageIndex={getStageIndex} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ job, isSelected, isUpdated, onSelect, getStageIndex }: any) {
  const currentStage = getStageIndex(job.status);
  const isActive = !['completed', 'failed'].includes(job.status);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border transition-all duration-300 ${
      isUpdated ? "border-indigo-400 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20" : "border-gray-200 dark:border-gray-700 hover:shadow-md"
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{job.repository_full_name}</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{job.problem_statement}</h3>
          </div>
          {job.pr_url && (
            <a href={job.pr_url} target="_blank" rel="noopener noreferrer"
              className="flex-shrink-0 px-3 py-1 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 transition-colors">
              PR →
            </a>
          )}
        </div>

        {/* Progress */}
        <div className="flex items-center gap-1.5 mb-3">
          {STATUS_STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStage || job.status === 'completed';
            const isCurrent = idx === currentStage && isActive;
            return (
              <div key={stage.key} className="flex-1 flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all mb-1 ${
                  job.status === 'failed' ? 'bg-rose-100 dark:bg-rose-900/20 text-rose-600' :
                  isCompleted ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600' :
                  isCurrent ? 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 animate-pulse' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-400'
                }`}>
                  {job.status === 'failed' ? (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  ) : isCompleted ? (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : isCurrent ? (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <circle cx="10" cy="10" r="3" />
                    </svg>
                  ) : idx + 1}
                </div>
                <span className="text-xs text-gray-400 hidden sm:block">{stage.label}</span>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {job.error_message && (
          <div className="mb-3 p-2 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded text-xs text-rose-700 dark:text-rose-300">
            {job.error_message}
          </div>
        )}

        <button onClick={onSelect}
          className="w-full py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          {isSelected ? 'Hide Details ↑' : 'View Details ↓'}
        </button>
      </div>

      {isSelected && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4 space-y-4 animate-fade-in">
          {job.rca && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Root Cause Analysis
              </h4>
              <div className="prose prose-sm prose-slate dark:prose-invert max-w-none bg-white dark:bg-gray-800 rounded p-3 text-xs">
                <ReactMarkdown>{job.rca}</ReactMarkdown>
              </div>
            </div>
          )}
          {job.files_changed && job.files_changed.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Files ({job.files_changed.length})
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded overflow-hidden max-h-32 overflow-y-auto">
                {job.files_changed.map((file: string, i: number) => (
                  <div key={i} className="px-3 py-1.5 text-xs font-mono text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    {file}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
