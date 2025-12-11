import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";

/**
 * Settings Page
 *
 * Allows users to configure:
 * - Claude Code CLI token
 * - Anthropic API key (alternative)
 * - Notification preferences (future)
 */
export default async function SettingsPage() {
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Settings
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage your Claude Bot configuration
              </p>
            </div>
            <a
              href="/dashboard"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SettingsClient user={user} />
      </div>
    </main>
  );
}
