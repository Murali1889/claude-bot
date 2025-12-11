import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  // Check if user is already logged in
  const user = await getSessionUser();

  // If logged in, redirect to dashboard
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-3xl text-center">
        <div className="mb-8">
          <h1 className="text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            Claude Bot
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            AI-powered code fixes for your GitHub repositories
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white">
            How it works
          </h2>
          <ol className="text-left space-y-6 text-gray-600 dark:text-gray-300">
            <li className="flex items-start">
              <span className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center mr-4 flex-shrink-0 font-semibold">
                1
              </span>
              <div>
                <p className="font-semibold text-gray-800 dark:text-white mb-1">
                  Sign in with GitHub
                </p>
                <p className="text-sm">
                  Authenticate securely using your GitHub account
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center mr-4 flex-shrink-0 font-semibold">
                2
              </span>
              <div>
                <p className="font-semibold text-gray-800 dark:text-white mb-1">
                  Install the GitHub App
                </p>
                <p className="text-sm">
                  Grant access to your repositories where you want AI assistance
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center mr-4 flex-shrink-0 font-semibold">
                3
              </span>
              <div>
                <p className="font-semibold text-gray-800 dark:text-white mb-1">
                  Configure your API key
                </p>
                <p className="text-sm">
                  Add your Anthropic API key securely (encrypted at rest)
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center mr-4 flex-shrink-0 font-semibold">
                4
              </span>
              <div>
                <p className="font-semibold text-gray-800 dark:text-white mb-1">
                  Mention @claude in issues
                </p>
                <p className="text-sm">
                  Get AI-powered code fixes automatically via pull requests
                </p>
              </div>
            </li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="/api/auth/login"
            className="inline-flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-4 rounded-lg font-semibold hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors shadow-lg"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Sign in with GitHub
          </a>
        </div>

        <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
          <p>
            Secure • Open Source • Privacy-focused
          </p>
        </div>
      </div>
    </main>
  );
}
