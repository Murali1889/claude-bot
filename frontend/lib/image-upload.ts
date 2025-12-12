/**
 * Image Upload Utilities
 * Handles image compression, base64 encoding, and URL uploads
 */

export interface ImageUploadResult {
  url?: string;
  base64?: string;
  filename: string;
  size: number;
  type: string;
}

/**
 * Compress image to reduce size
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to compress image"));
            }
          },
          file.type,
          quality
        );
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert image file to base64
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload image to temporary storage and get URL
 * For now, returns base64 - can be extended to upload to S3/GCS
 */
export async function uploadImage(
  file: File
): Promise<ImageUploadResult> {
  // Compress if image is large
  let processedFile: File | Blob = file;

  if (file.size > 100 * 1024) {
    // > 100KB
    processedFile = await compressImage(file);
  }

  const base64 = await fileToBase64(processedFile);

  return {
    base64,
    filename: file.name,
    size: processedFile.size,
    type: file.type,
  };
}

/**
 * Process multiple image files
 */
export async function processImages(
  files: FileList | File[]
): Promise<{
  imageUrls: string[];
  screenshotsBase64: string[];
  totalSize: number;
}> {
  const imageUrls: string[] = [];
  const screenshotsBase64: string[] = [];
  let totalSize = 0;

  const fileArray = Array.from(files);

  for (const file of fileArray) {
    if (!file.type.startsWith("image/")) {
      console.warn(`Skipping non-image file: ${file.name}`);
      continue;
    }

    try {
      const result = await uploadImage(file);

      // If image is small enough, use base64
      // Otherwise, would upload to cloud storage
      if (result.size < 200 * 1024 && result.base64) {
        // < 200KB
        screenshotsBase64.push(result.base64);
      } else if (result.base64) {
        // For now, still use base64 for larger images
        // In production, upload to S3 and use URL
        screenshotsBase64.push(result.base64);
      }

      totalSize += result.size;
    } catch (error) {
      console.error(`Failed to process image ${file.name}:`, error);
    }
  }

  return {
    imageUrls,
    screenshotsBase64,
    totalSize,
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  // Check file type
  if (!file.type.startsWith("image/")) {
    return {
      valid: false,
      error: "File must be an image",
    };
  }

  // Check file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return {
      valid: false,
      error: "Image must be smaller than 10MB",
    };
  }

  return { valid: true };
}
