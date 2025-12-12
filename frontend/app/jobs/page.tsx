import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import JobsClient from "./JobsClient";

/**
 * Jobs Dashboard Page
 *
 * Shows:
 * - All fix jobs for the user
 * - Job status with visual indicators
 * - RCA content in expandable cards
 * - Files changed
 * - PR links
 * - Real-time status updates
 */
export default async function JobsPage() {
  // Require authentication
  const user = await getSessionUser();

  if (!user) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Fix Jobs
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Track your automated code fixes
              </p>
            </div>
            <div className="flex items-center gap-3">
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
                New Fix
              </a>
              <a
                href="/dashboard"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Dashboard
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <JobsClient user={user} />
      </div>
    </main>
  );
}
