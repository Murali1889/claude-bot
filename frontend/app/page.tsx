export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
          Claude Bot
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          AI-powered code fixes for your GitHub repositories
        </p>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-white">
            How it works
          </h2>
          <ol className="text-left space-y-4 text-gray-600 dark:text-gray-300">
            <li className="flex items-start">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0">
                1
              </span>
              Install the Claude Bot GitHub App on your repository
            </li>
            <li className="flex items-start">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0">
                2
              </span>
              Configure your Anthropic API key on the setup page
            </li>
            <li className="flex items-start">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0">
                3
              </span>
              Mention @claude in any issue to get AI-powered fixes
            </li>
          </ol>
        </div>

        <a
          href="https://github.com/apps/self-healing-claude"
          className="inline-block bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
        >
          Install GitHub App
        </a>
      </div>
    </main>
  );
}
