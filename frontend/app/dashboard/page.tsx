import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

/**
 * Dashboard Page
 *
 * Shows:
 * - User profile
 * - GitHub App installations
 * - Repositories for each installation
 * - Install/Configure buttons
 *
 * Security:
 * - Server-side authentication check
 * - Only shows user's own data
 */
export default async function Dashboard() {
  // Require authentication
  const user = await getSessionUser();

  if (!user) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {user.avatar_url && (
                <img
                  src={user.avatar_url}
                  alt={user.github_username}
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Dashboard
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Welcome back, {user.github_username}
                </p>
              </div>
            </div>
            <a
              href="/api/auth/logout"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Logout
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardClient user={user} />
      </div>
    </main>
  );
}
