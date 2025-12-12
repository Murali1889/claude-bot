"use client";

import { useState } from "react";
import ImageUploader from "@/components/ImageUploader";

interface RCAEditorProps {
  jobId: string;
  originalRca: string;
  onClose: () => void;
  onRegenerate?: () => void;
}

export default function RCAEditor({
  jobId,
  originalRca,
  onClose,
  onRegenerate,
}: RCAEditorProps) {
  const [editedRca, setEditedRca] = useState(originalRca);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(true);
  const [imageData, setImageData] = useState<{
    imageUrls: string[];
    screenshotsBase64: string[];
  }>({
    imageUrls: [],
    screenshotsBase64: [],
  });

  const handleRegenerate = async () => {
    if (!editedRca.trim()) {
      setError("RCA cannot be empty");
      return;
    }

    if (editedRca === originalRca) {
      setError("No changes detected. Please edit the RCA before regenerating.");
      return;
    }

    setIsRegenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/fix/regenerate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_id: jobId,
          edited_rca: editedRca,
          image_urls: imageData.imageUrls,
          screenshots_base64: imageData.screenshotsBase64,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to regenerate");
      }

      console.log("Regeneration started:", data);

      // Call the callback if provided
      if (onRegenerate) {
        onRegenerate();
      }

      // Close the editor
      onClose();
    } catch (err) {
      console.error("Regeneration error:", err);
      setError(err instanceof Error ? err.message : "Failed to regenerate");
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            Edit Root Cause Analysis
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isRegenerating}
          >
            <svg
              className="w-6 h-6"
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
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setIsPreview(false)}
            className={`px-6 py-3 font-medium transition-colors ${
              !isPreview
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Edit
          </button>
          <button
            onClick={() => setIsPreview(true)}
            className={`px-6 py-3 font-medium transition-colors ${
              isPreview
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Preview
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {isPreview ? (
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg border border-gray-200">
                {editedRca}
              </pre>
            </div>
          ) : (
            <div className="space-y-4">
              <textarea
                value={editedRca}
                onChange={(e) => setEditedRca(e.target.value)}
                className="w-full h-full min-h-[300px] p-4 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Edit the Root Cause Analysis..."
                disabled={isRegenerating}
              />

              <div className="border-t border-gray-200 pt-4">
                <ImageUploader
                  maxImages={3}
                  onImagesProcessed={(data) => setImageData(data)}
                />
                <p className="text-xs text-gray-500 mt-2">
                  💡 Add screenshots to provide additional visual context for the
                  regeneration
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {editedRca === originalRca ? (
              <span>No changes made</span>
            ) : (
              <span className="text-blue-600 font-medium">
                Changes detected - ready to regenerate
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isRegenerating}
            >
              Cancel
            </button>
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating || editedRca === originalRca}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isRegenerating || editedRca === originalRca
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {isRegenerating ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Regenerating...
                </span>
              ) : (
                "Regenerate Code"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
