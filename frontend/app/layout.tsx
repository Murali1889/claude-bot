import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Bot Setup",
  description: "Configure your Anthropic API key for Claude Bot",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        {children}
      </body>
    </html>
  );
}
