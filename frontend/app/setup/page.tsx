"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

/**
 * GitHub App Installation Redirect Handler
 *
 * This page is shown after installing the GitHub App.
 * It captures the installation and redirects to dashboard.
 */
function SetupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Capturing installation...");

  useEffect(() => {
    const captureInstallation = async () => {
      const installation_id = searchParams.get("installation_id");
      const setup_action = searchParams.get("setup_action");

      if (!installation_id) {
        setStatus("error");
        setMessage("Missing installation ID");
        return;
      }

      try {
        const response = await fetch("/api/installations/capture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            installation_id,
            setup_action: setup_action || "install",
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage("Installation captured! Redirecting to dashboard...");

          // Redirect to dashboard after 1 second
          setTimeout(() => {
            router.push("/dashboard");
          }, 1000);
        } else {
          setStatus("error");
          setMessage(data.error || "Failed to capture installation");
        }
      } catch (error) {
        setStatus("error");
        setMessage("Network error. Please try again.");
      }
    };

    captureInstallation();
  }, [searchParams, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 text-center">
        {status === "loading" && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Setting up...
            </h1>
            <p className="text-gray-600 dark:text-gray-300">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Success!
            </h1>
            <p className="text-gray-600 dark:text-gray-300">{message}</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Error
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{message}</p>
            <a
              href="/dashboard"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </a>
          </>
        )}
      </div>
    </main>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
      </main>
    }>
      <SetupContent />
    </Suspense>
  );
}
