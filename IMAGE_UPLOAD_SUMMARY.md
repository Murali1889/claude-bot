# Image Upload Implementation - Complete Summary

## ✅ What Was Implemented

### 1. **GitHub Actions Workflow** (`fix-code-production.yml`)

**New Workflow Inputs:**
```yaml
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

**New Processing Step:**
- Downloads images from URLs
- Decodes base64-encoded screenshots
- Saves to `.claude-context/images/` directory
- Makes images available to Claude during RCA and code generation
- Automatically excludes images from commits

**Integration with Claude:**
- RCA generation includes visual context
- Code changes reference screenshots
- Claude can analyze images to understand issues better

---

### 2. **Backend Service** (`frontend/lib/executor-service-workflow.ts`)

**Updated Interface:**
```typescript
interface ExecuteFixParams {
  // ... existing params
  imageUrls?: string[];        // NEW
  screenshotsBase64?: string[]; // NEW
}
```

**Workflow Trigger:**
- Converts imageUrls array to comma-separated string
- Converts screenshotsBase64 array to JSON string
- Passes both to GitHub Actions workflow

---

### 3. **Image Processing Library** (`frontend/lib/image-upload.ts`)

**Key Features:**

1. **Compression**
   - Max dimensions: 1920x1080
   - Quality: 80%
   - Auto-compress files > 100KB

2. **Base64 Encoding**
   - Converts images to base64 strings
   - Removes data URL prefix

3. **Batch Processing**
   - Process multiple images at once
   - Returns both URLs and base64 data
   - Tracks total size

4. **Validation**
   - File type checking (images only)
   - Size limits (max 10MB per image)
   - Error reporting

**Functions:**
```typescript
compressImage(file, maxWidth, maxHeight, quality): Promise<Blob>
fileToBase64(file): Promise<string>
uploadImage(file): Promise<ImageUploadResult>
processImages(files): Promise<{imageUrls, screenshotsBase64, totalSize}>
validateImageFile(file): {valid, error?}
formatFileSize(bytes): string
```

---

### 4. **Image Uploader Component** (`frontend/components/ImageUploader.tsx`)

**Features:**

✅ Multiple image selection
✅ Image previews with thumbnails
✅ Remove images individually
✅ Real-time size tracking
✅ Automatic processing
✅ Max image limit (configurable, default: 5)
✅ Error handling with user feedback
✅ Processing indicator
✅ Helpful tips for users

**Props:**
```typescript
interface ImageUploaderProps {
  onImagesProcessed: (data: {
    imageUrls: string[];
    screenshotsBase64: string[];
  }) => void;
  maxImages?: number;
}
```

**Usage:**
```tsx
<ImageUploader
  maxImages={5}
  onImagesProcessed={(data) => setImageData(data)}
/>
```

---

### 5. **Regeneration API** (`frontend/app/api/fix/regenerate/route.ts`)

**Updated to Support Images:**

```typescript
// Request body
{
  job_id: string;
  edited_rca: string;
  image_urls?: string[];        // NEW
  screenshots_base64?: string[]; // NEW
}

// Passes images to executeFix
await executeFix({
  // ... existing params
  imageUrls: image_urls || [],
  screenshotsBase64: screenshots_base64 || [],
});
```

**Logging:**
- Logs number of image URLs provided
- Logs number of base64 screenshots provided
- Helps with debugging

---

### 6. **RCA Editor Component** (`frontend/app/dashboard/RCAEditor.tsx`)

**Enhanced with Image Upload:**

✅ Integrated ImageUploader component
✅ Shows in Edit tab (not Preview)
✅ Allows adding images during regeneration
✅ Passes images with edited RCA
✅ Max 3 images for regeneration

**UI Layout:**
```
┌─────────────────────────────────┐
│  Edit RCA Modal                 │
├─────────────────────────────────┤
│  [Edit] [Preview]              │
├─────────────────────────────────┤
│  Textarea for RCA editing      │
│  (when in Edit tab)            │
│                                 │
│  ─────────────────────────     │
│                                 │
│  ImageUploader Component        │
│  (upload additional context)    │
└─────────────────────────────────┘
```

---

## 📋 Integration Checklist

### To Use Image Upload in Your App:

#### 1. **Update Fix Creation Form**

```tsx
// Example: frontend/app/fix/page.tsx

import ImageUploader from "@/components/ImageUploader";

function CreateFixPage() {
  const [problemStatement, setProblemStatement] = useState("");
  const [imageData, setImageData] = useState({
    imageUrls: [],
    screenshotsBase64: [],
  });

  const handleSubmit = async () => {
    await fetch("/api/fix/execute", {
      method: "POST",
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

#### 2. **Update Execute API**

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

  // ... existing code

  await executeFix({
    // ... existing params
    imageUrls: image_urls || [],
    screenshotsBase64: screenshots_base64 || [],
  });
}
```

#### 3. **Deploy Production Workflow**

```bash
# Copy workflow to worker repository
cp fix-code-production.yml /path/to/claude-bot-worker/.github/workflows/

cd /path/to/claude-bot-worker
git add .github/workflows/fix-code-production.yml
git commit -m "Add image upload support to workflow"
git push origin main
```

#### 4. **Test the Feature**

1. Create a fix job with screenshot
2. Verify image appears in workflow logs
3. Check Claude references the image in RCA/code
4. Test regeneration with new images

---

## 🎯 Use Cases

### 1. **UI Bug Fixes**

**Scenario:** Button alignment is broken on mobile

**Images:**
- Screenshot showing misaligned button
- Expected design mockup

**Result:** Claude sees the visual issue and fixes CSS/layout

---

### 2. **Error Debugging**

**Scenario:** Getting 500 error on API call

**Images:**
- Browser console with error stack trace
- Network tab showing failed request

**Result:** Claude analyzes error details and fixes root cause

---

### 3. **Design Implementation**

**Scenario:** Implement new dashboard design

**Images:**
- Figma mockup or design screenshot
- Current state for comparison

**Result:** Claude implements the design based on visual reference

---

### 4. **RCA Regeneration with Context**

**Scenario:** Initial fix was wrong, need to regenerate

**Flow:**
1. User reviews RCA and code
2. Clicks "Edit RCA"
3. Updates RCA with better analysis
4. Adds screenshot showing missed issue
5. Regenerates with improved context

**Result:** Better fix with additional visual context

---

## 🔧 Technical Details

### Image Processing Pipeline

```
User selects image
    ↓
Validate (type, size)
    ↓
Compress if > 100KB
    ↓
Convert to base64
    ↓
Add to array
    ↓
Pass to API
    ↓
API triggers workflow
    ↓
Workflow processes images
    ↓
Claude analyzes images
    ↓
Fix generated
```

### Size Optimization

| Image Size | Action | Result |
|------------|--------|--------|
| < 100KB | No compression | Original |
| 100KB - 1MB | Compress (80% quality) | ~200-400KB |
| > 1MB | Compress (80% quality) + resize | ~300-500KB |

### Workflow Input Limits

- **Total input size**: ~65KB for all workflow inputs
- **Base64 overhead**: +33% size increase
- **Practical limit**: 1-2 small images via base64
- **Solution**: Use image URLs for larger/more images

---

## 📊 Monitoring & Debugging

### Check Image Processing

**In Workflow Logs:**
```bash
📸 Downloading images from URLs...
  Downloading: https://... -> screenshot_0.png
✅ Processed 3 images
```

**In Claude Prompts:**
```
## Visual Context
Screenshots are available in .claude-context/images/ directory.
These provide visual context for the problem.
```

### Verify Images Available

```bash
# In workflow step
ls -lh .claude-context/images/
# Should show:
# screenshot_0.png
# screenshot_1.png
```

### Check Frontend

```javascript
console.log('Image data:', {
  urls: imageData.imageUrls.length,
  base64: imageData.screenshotsBase64.length,
  totalSize: formatFileSize(totalSize)
});
```

---

## ⚠️ Known Limitations

### 1. **Workflow Input Size**
- GitHub Actions inputs limited to ~65KB
- Base64 encoding adds 33% overhead
- **Workaround**: Use image URLs for larger images

### 2. **Claude Image Analysis**
- Claude Code (CLI) has limited image viewing capabilities
- Best for screenshots with text/code
- **Future**: Direct image analysis support

### 3. **Storage**
- Currently no persistent storage
- Images processed and discarded
- **Future**: Store in S3/GCS for reference

---

## 🚀 Future Enhancements

### 1. Cloud Storage Integration

```typescript
// Upload to S3 and get URL
const url = await uploadToS3(file);
imageUrls.push(url);

// Workflow downloads from S3
curl -L -o "screenshot.png" "$S3_URL"
```

### 2. Direct Image Analysis

```typescript
// Send images directly to Claude API
const analysis = await claude.analyzeImage(imageBase64);
```

### 3. Image Annotations

```typescript
// Allow users to annotate images
interface Annotation {
  type: 'arrow' | 'highlight' | 'text';
  x: number;
  y: number;
  text?: string;
}
```

### 4. Video Support

```typescript
// Upload screen recordings
interface VideoContext {
  videoUrl: string;
  thumbnails: string[];
}
```

---

## 📚 Related Documentation

- `IMAGE_UPLOAD_GUIDE.md` - Comprehensive guide
- `RCA_EDITING_FEATURE.md` - RCA editing with images
- `fix-code-production.yml` - Workflow with image support

---

## ✅ Testing Checklist

- [ ] Upload single image (< 100KB)
- [ ] Upload multiple images (5 images)
- [ ] Upload large image (> 1MB) - should compress
- [ ] Upload invalid file (PDF) - should reject
- [ ] Trigger workflow with images
- [ ] Verify images in workflow logs
- [ ] Test regeneration with new images
- [ ] Check images excluded from commits
- [ ] Test with image URLs
- [ ] Test with base64 screenshots

---

## 🎓 Developer Notes

### Adding Image Upload to New Forms

1. Import component: `import ImageUploader from "@/components/ImageUploader"`
2. Add state: `const [imageData, setImageData] = useState({...})`
3. Render component: `<ImageUploader onImagesProcessed={setImageData} />`
4. Pass to API: `image_urls: imageData.imageUrls`

### Customizing Upload Behavior

```typescript
// Change max images
<ImageUploader maxImages={10} />

// Custom compression
await compressImage(file, 1280, 720, 0.6);

// Custom validation
if (file.size > 5 * 1024 * 1024) {
  return { valid: false, error: 'Max 5MB' };
}
```

### Debugging Tips

1. **Check file selection**: `console.log(files.length)`
2. **Check compression**: `console.log({before: file.size, after: compressed.size})`
3. **Check base64**: `console.log(base64.length)`
4. **Check workflow**: View GitHub Actions logs
5. **Check Claude**: Search logs for "Visual Context"

---

## 💡 Best Practices

### For Users
- Use clear, focused screenshots
- Include error messages and stack traces
- Crop unnecessary parts
- Use PNG for screenshots, JPG for photos

### For Developers
- Validate early and show clear errors
- Compress aggressively to save bandwidth
- Provide real-time feedback during upload
- Log image counts for debugging
- Handle errors gracefully

---

## Support

If you encounter issues:
1. Check browser console for upload errors
2. Verify image file types and sizes
3. Check workflow logs in GitHub Actions
4. Test with smaller images first
5. Review `IMAGE_UPLOAD_GUIDE.md` for troubleshooting
