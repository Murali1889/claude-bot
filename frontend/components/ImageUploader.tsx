"use client";

import { useState, useRef } from "react";
import {
  processImages,
  formatFileSize,
  validateImageFile,
} from "@/lib/image-upload";

interface ImageUploaderProps {
  onImagesProcessed: (data: {
    imageUrls: string[];
    screenshotsBase64: string[];
  }) => void;
  maxImages?: number;
}

export default function ImageUploader({
  onImagesProcessed,
  maxImages = 5,
}: ImageUploaderProps) {
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);

    // Validate files
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of fileArray) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || "Invalid file");
        continue;
      }

      // Check max images limit
      if (images.length + validFiles.length >= maxImages) {
        setError(`Maximum ${maxImages} images allowed`);
        break;
      }

      validFiles.push(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviews.push(e.target?.result as string);
        if (newPreviews.length === validFiles.length) {
          setPreviews((prev) => [...prev, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    }

    const updatedImages = [...images, ...validFiles];
    setImages(updatedImages);

    // Process images immediately
    setProcessing(true);
    try {
      const result = await processImages(updatedImages);
      onImagesProcessed(result);
    } catch (err) {
      console.error("Failed to process images:", err);
      setError("Failed to process images");
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveImage = async (index: number) => {
    const updatedImages = images.filter((_, i) => i !== index);
    const updatedPreviews = previews.filter((_, i) => i !== index);

    setImages(updatedImages);
    setPreviews(updatedPreviews);

    // Reprocess remaining images
    if (updatedImages.length > 0) {
      setProcessing(true);
      try {
        const result = await processImages(updatedImages);
        onImagesProcessed(result);
      } catch (err) {
        console.error("Failed to process images:", err);
        setError("Failed to process images");
      } finally {
        setProcessing(false);
      }
    } else {
      onImagesProcessed({ imageUrls: [], screenshotsBase64: [] });
    }
  };

  const totalSize = images.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Screenshots / Images (Optional)
        </label>
        {images.length > 0 && (
          <span className="text-xs text-gray-500">
            {images.length} / {maxImages} images ({formatFileSize(totalSize)})
          </span>
        )}
      </div>

      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={processing || images.length >= maxImages}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {processing ? "Processing..." : "Choose Images"}
        </button>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          PNG, JPG, GIF up to 10MB each
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {previews.map((preview, index) => (
            <div
              key={index}
              className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
            >
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="w-full h-32 object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  Remove
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-1 truncate">
                {images[index].name}
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <p className="font-medium">💡 Tips for better results:</p>
          <ul className="list-disc list-inside space-y-1 text-xs ml-2">
            <li>Include error screenshots to show the exact problem</li>
            <li>Add UI mockups if you want specific design changes</li>
            <li>Include console logs or stack traces as images</li>
            <li>Show before/after comparisons if relevant</li>
          </ul>
        </div>
      )}
    </div>
  );
}
