# Image Upload Feature Guide

## Overview

The image upload feature allows users to attach screenshots, error images, UI mockups, or any visual context to help Claude better understand and fix the problem. This is especially useful for:

- **UI/UX bugs**: Show exactly what's wrong visually
- **Error screenshots**: Include stack traces, console errors
- **Design changes**: Provide mockups or design references
- **Visual comparison**: Show before/after examples

## How It Works

### 1. Image Processing Flow

```
User uploads images
    ↓
Frontend validates & compresses
    ↓
Convert to base64 or upload to URL
    ↓
Send to API with fix request
    ↓
API passes to GitHub Actions workflow
    ↓
Workflow downloads/decodes images
    ↓
Claude analyzes images + code
    ↓
Generates fix based on visual context
```

### 2. Supported Methods

#### Method 1: Base64 Encoding (Current Default)
- **Best for**: Small images (< 200KB)
- **Pros**: No external dependencies, simple
- **Cons**: Limited by workflow input size (65KB total for all inputs)
- **Use case**: Error screenshots, small UI bugs

#### Method 2: Image URLs
- **Best for**: Larger images, external screenshots
- **Pros**: No size limits, faster workflow trigger
- **Cons**: Requires images to be publicly accessible
- **Use case**: Design mockups from Figma, existing screenshots

#### Method 3: Cloud Storage (Future Enhancement)
- **Best for**: Multiple large images
- **Pros**: Scalable, fast, no limits
- **Cons**: Requires setup (S3/GCS)
- **Use case**: Production deployments with many images

## Implementation Details

### Frontend Components

#### 1. Image Upload Utility (`frontend/lib/image-upload.ts`)

**Key Functions:**

```typescript
// Compress large images
compressImage(file: File, maxWidth: number, maxHeight: number, quality: number): Promise<Blob>

// Convert to base64
fileToBase64(file: File | Blob): Promise<string>

// Process multiple images
processImages(files: FileList | File[]): Promise<{
  imageUrls: string[];
  screenshotsBase64: string[];
  totalSize: number;
}>

// Validate image
validateImageFile(file: File): { valid: boolean; error?: string }
```

**Compression Settings:**
- Max width: 1920px
- Max height: 1080px
- Quality: 80%
- Automatic compression for files > 100KB

#### 2. Image Uploader Component (`frontend/components/ImageUploader.tsx`)

**Features:**
- Drag & drop support (can be added)
- Multiple image upload
- Image preview with thumbnails
- Remove images
- Size validation (max 10MB per image)
- Max images limit (default: 5)
- Real-time processing
- Error handling

**Usage Example:**

```tsx
import ImageUploader from "@/components/ImageUploader";

function FixForm() {
  const [imageData, setImageData] = useState({
    imageUrls: [],
    screenshotsBase64: [],
  });

  return (
    <ImageUploader
      maxImages={5}
      onImagesProcessed={(data) => setImageData(data)}
    />
  );
}
```

### Backend Integration

#### 1. Executor Service (`frontend/lib/executor-service-workflow.ts`)

**New Parameters:**

```typescript
interface ExecuteFixParams {
  // ... existing params
  imageUrls?: string[];        // Array of image URLs
  screenshotsBase64?: string[]; // Array of base64-encoded images
}
```

**Workflow Trigger:**

```typescript
await triggerWorkerWorkflow(
  // ... existing params
  imageUrls,         // Passed as comma-separated string
  screenshotsBase64  // Passed as JSON array
);
```

### GitHub Actions Workflow

#### 1. Workflow Inputs (`fix-code-production.yml`)

```yaml
inputs:
  image_urls:
    description: 'Image URLs (comma-separated) for visual context'
    required: false
    type: string
    default: ''

  screenshots_base64:
    description: 'Base64-encoded screenshots (JSON array)'
    required: false
    type: string
    default: ''
```

#### 2. Image Processing Step

```yaml
- name: Process Images
  id: process_images
  run: |
    cd repo
    mkdir -p .claude-context/images

    # Download from URLs
    if [ -n "${{ inputs.image_urls }}" ]; then
      IFS=',' read -ra URLS <<< "${{ inputs.image_urls }}"
      for url in "${URLS[@]}"; do
        curl -L -o ".claude-context/images/screenshot_${i}.png" "$url"
      done
    fi

    # Decode base64
    if [ -n "${{ inputs.screenshots_base64 }}" ]; then
      echo '${{ inputs.screenshots_base64 }}' | jq -r '.[]' | while read line; do
        echo "$line" | base64 -d > ".claude-context/images/screenshot_${i}.png"
      done
    fi
```

#### 3. Claude Integration

**RCA Generation with Images:**

```bash
claude --model sonnet -p "
  ## Problem Statement
  ${{ inputs.problem_statement }}

  ## Visual Context
  IMPORTANT: Review screenshots in .claude-context/images/
  These provide visual context for the problem.
  Analyze the images to understand the issue better.

  Generate comprehensive RCA...
"
```

**Code Changes with Images:**

```bash
claude --model sonnet -p "
  ## Problem
  ${{ inputs.problem_statement }}

  ## Visual Context
  Screenshots are available in .claude-context/images/
  Review them to understand what needs to be fixed.

  ## Instructions
  1. Read RCA.md
  2. Review screenshots in .claude-context/images/
  3. Make necessary code changes
  4. DO NOT commit images (context only)

  Implement the fix now.
"
```

## Integration with Fix Form

### Step 1: Add Database Column (Optional)

If you want to store image metadata:

```sql
ALTER TABLE fix_jobs
ADD COLUMN IF NOT EXISTS image_urls TEXT[],
ADD COLUMN IF NOT EXISTS image_count INTEGER DEFAULT 0;
```

### Step 2: Update Fix Form

Example integration in your fix creation form:

```tsx
// frontend/app/fix/page.tsx or similar

import ImageUploader from "@/components/ImageUploader";

function CreateFixForm() {
  const [problemStatement, setProblemStatement] = useState("");
  const [imageData, setImageData] = useState({
    imageUrls: [] as string[],
    screenshotsBase64: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const response = await fetch("/api/fix/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repository_id: selectedRepo,
        problem_statement: problemStatement,
        image_urls: imageData.imageUrls,
        screenshots_base64: imageData.screenshotsBase64,
      }),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={problemStatement}
        onChange={(e) => setProblemStatement(e.target.value)}
        placeholder="Describe the problem..."
      />

      <ImageUploader
        maxImages={5}
        onImagesProcessed={setImageData}
      />

      <button type="submit">Create Fix</button>
    </form>
  );
}
```

### Step 3: Update Execute API

```typescript
// frontend/app/api/fix/execute/route.ts

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    repository_id,
    problem_statement,
    image_urls,
    screenshots_base64,
  } = body;

  // Create job and trigger workflow
  await executeFix({
    // ... existing params
    imageUrls: image_urls || [],
    screenshotsBase64: screenshots_base64 || [],
  });
}
```

## Usage Examples

### Example 1: UI Bug with Screenshot

**Problem**: "Button is misaligned on mobile"

**Images**: Upload screenshot showing the misaligned button

**Result**: Claude sees the visual issue and fixes the CSS/layout

### Example 2: Error Screenshot

**Problem**: "Getting 500 error on login"

**Images**: Upload screenshot of browser console with error stack trace

**Result**: Claude analyzes the error and fixes the root cause

### Example 3: Design Implementation

**Problem**: "Implement new dashboard design"

**Images**: Upload Figma mockup or design screenshot

**Result**: Claude implements the design based on the visual reference

### Example 4: Visual Comparison

**Problem**: "Search results look different than expected"

**Images**:
- Screenshot 1: Current broken state
- Screenshot 2: Expected design

**Result**: Claude compares both and implements the fix

## Size Limits and Optimization

### Current Limits

1. **Per Image**: 10MB max (before compression)
2. **Total Images**: 5 images max (configurable)
3. **Workflow Input**: ~65KB total for all inputs
   - Base64 encoding increases size by ~33%
   - Compressed 200KB image → ~270KB base64
   - Limit: ~1-2 images via base64

### Optimization Strategies

#### Strategy 1: Automatic Compression (Implemented)

```typescript
// Automatically compresses images > 100KB
if (file.size > 100 * 1024) {
  processedFile = await compressImage(file);
}
```

#### Strategy 2: Smart Method Selection

```typescript
// Small images: base64
if (result.size < 200 * 1024) {
  screenshotsBase64.push(result.base64);
}
// Large images: upload to URL (future)
else {
  const url = await uploadToS3(result);
  imageUrls.push(url);
}
```

#### Strategy 3: Progressive Quality

```typescript
// Try higher quality first, reduce if too large
let quality = 0.8;
while (compressedSize > targetSize && quality > 0.3) {
  compressed = await compressImage(file, 1920, 1080, quality);
  quality -= 0.1;
}
```

## Troubleshooting

### Issue: "Workflow input too large"

**Cause**: Too many/large base64 images exceed 65KB limit

**Solution**:
1. Reduce image count
2. Lower compression quality
3. Use image URLs instead of base64
4. Implement cloud storage upload

```typescript
// Check total size before triggering
const totalBase64Size = screenshotsBase64.join('').length;
if (totalBase64Size > 50000) {
  alert('Images too large. Please reduce image count or size.');
  return;
}
```

### Issue: "Images not appearing in Claude context"

**Cause**: Images not downloaded correctly

**Solution**:
1. Check workflow logs for download errors
2. Verify image URLs are publicly accessible
3. Check base64 encoding is correct

```bash
# In workflow, verify images
ls -lh .claude-context/images/
file .claude-context/images/*
```

### Issue: "Claude not referencing images"

**Cause**: Claude not prompted to look at images

**Solution**: Enhance prompts

```bash
# Better prompt
claude --model sonnet -p "
  CRITICAL: Before analyzing the code, FIRST review ALL images in:
  .claude-context/images/

  Use these commands to view images:
  1. ls .claude-context/images/
  2. cat .claude-context/images/screenshot_0.png (for text-based analysis)

  The images show [describe what images contain]

  Now analyze and fix based on visual + code context.
"
```

## Future Enhancements

### 1. Cloud Storage Integration

```typescript
// Upload to S3/GCS
async function uploadToCloud(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const { url } = await response.json();
  return url;
}
```

### 2. Image Annotation

Allow users to annotate images with arrows, highlights, text:

```typescript
interface AnnotatedImage {
  imageUrl: string;
  annotations: {
    type: 'arrow' | 'highlight' | 'text';
    x: number;
    y: number;
    text?: string;
  }[];
}
```

### 3. Video Support

Support screen recordings for complex issues:

```typescript
interface VideoContext {
  videoUrl: string;
  duration: number;
  thumbnails: string[];
}
```

### 4. OCR Integration

Extract text from screenshots automatically:

```typescript
async function extractTextFromImage(imageBase64: string): Promise<string> {
  // Use Tesseract.js or Cloud Vision API
  const text = await ocr(imageBase64);
  return text;
}
```

## Best Practices

### For Users

1. **Use Clear Screenshots**
   - High resolution
   - Full context visible
   - Highlight important areas

2. **Include Relevant Info**
   - Error messages
   - Console logs
   - Network tab (if API issue)

3. **Provide Context**
   - Add text description with images
   - Explain what's wrong in the image

4. **Optimize Images**
   - Crop unnecessary parts
   - Use PNG for screenshots
   - Use JPG for photos

### For Developers

1. **Validate Early**
   ```typescript
   const validation = validateImageFile(file);
   if (!validation.valid) {
     showError(validation.error);
     return;
   }
   ```

2. **Compress Aggressively**
   ```typescript
   // Aim for < 100KB per image
   await compressImage(file, 1280, 720, 0.7);
   ```

3. **Provide Feedback**
   ```typescript
   setStatus(`Processing ${files.length} images...`);
   setProgress((current / total) * 100);
   ```

4. **Handle Errors Gracefully**
   ```typescript
   try {
     await processImages(files);
   } catch (error) {
     showError('Failed to process images. Please try smaller files.');
   }
   ```

## Testing

### Test Case 1: Single Small Image

```bash
# Upload 1 PNG screenshot (50KB)
# Verify: Workflow processes correctly
# Expected: Image appears in .claude-context/images/
```

### Test Case 2: Multiple Images

```bash
# Upload 5 images (total 1MB)
# Verify: All compressed and processed
# Expected: All images available to Claude
```

### Test Case 3: Large Image

```bash
# Upload 8MB image
# Verify: Compression reduces size
# Expected: Compressed to ~200KB, processed successfully
```

### Test Case 4: Invalid File

```bash
# Upload PDF or non-image
# Verify: Validation rejects file
# Expected: Error message shown to user
```

## Monitoring

### Workflow Logs

Check image processing in GitHub Actions:

```bash
# Look for these messages
📸 Downloading images from URLs...
📸 Decoding base64 screenshots...
✅ Processed 3 images
```

### Size Tracking

Monitor image sizes:

```typescript
const stats = {
  totalImages: images.length,
  totalSize: formatFileSize(totalSize),
  compressionRatio: (originalSize / compressedSize).toFixed(2),
};
console.log('Image upload stats:', stats);
```

## Related Files

- `fix-code-production.yml` - Workflow with image support
- `frontend/lib/image-upload.ts` - Image processing utilities
- `frontend/components/ImageUploader.tsx` - Upload component
- `frontend/lib/executor-service-workflow.ts` - Workflow trigger with images

## Support

For issues:
1. Check browser console for upload errors
2. Verify image file types and sizes
3. Check workflow logs for processing errors
4. Test with smaller images first
