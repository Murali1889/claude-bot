import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { executeFix } from "@/lib/executor-service-workflow";

/**
 * POST /api/fix/regenerate
 * Regenerate code changes with edited RCA
 */
export async function POST(request: NextRequest) {
  console.log("[regenerate] Starting regeneration request");

  try {
    const supabase = createServerClient();

    // Get user session
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("[regenerate] Authentication error:", userError);
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { job_id, edited_rca, image_urls, screenshots_base64 } = body;

    if (!job_id || !edited_rca) {
      console.error("[regenerate] Missing required fields:", { job_id, edited_rca });
      return NextResponse.json(
        { success: false, error: "job_id and edited_rca are required" },
        { status: 400 }
      );
    }

    // Log image data if provided
    if (image_urls && image_urls.length > 0) {
      console.log(`[regenerate] Image URLs provided: ${image_urls.length}`);
    }
    if (screenshots_base64 && screenshots_base64.length > 0) {
      console.log(`[regenerate] Base64 screenshots provided: ${screenshots_base64.length}`);
    }

    console.log(`[regenerate] Job ID: ${job_id}`);
    console.log(`[regenerate] Edited RCA length: ${edited_rca.length} characters`);

    // Get existing job to verify ownership and get data
    const { data: existingJob, error: jobError } = await supabase
      .from("fix_jobs")
      .select("*")
      .eq("id", job_id)
      .eq("user_id", user.id)
      .single();

    if (jobError || !existingJob) {
      console.error("[regenerate] Job not found or access denied:", jobError);
      return NextResponse.json(
        { success: false, error: "Job not found or access denied" },
        { status: 404 }
      );
    }

    console.log(`[regenerate] Found job: ${existingJob.repository_full_name}`);

    // Update job with edited RCA
    const currentRegenCount = existingJob.regeneration_count || 0;
    console.log(`[regenerate] Current regeneration count: ${currentRegenCount}`);

    const { error: updateError } = await supabase
      .from("fix_jobs")
      .update({
        user_edited_rca: edited_rca,
        rca_edited: true,
        regeneration_count: currentRegenCount + 1,
        status: "pending",
      })
      .eq("id", job_id);

    if (updateError) {
      console.error("[regenerate] Failed to update job:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update job" },
        { status: 500 }
      );
    }

    console.log(`[regenerate] Job updated with edited RCA`);

    // Trigger workflow with edited RCA and optional images
    console.log(`[regenerate] Triggering workflow with edited RCA...`);
    await executeFix({
      jobId: job_id,
      installationId: existingJob.installation_id,
      repositoryFullName: existingJob.repository_full_name,
      problemStatement: existingJob.problem_statement,
      complexity: existingJob.complexity || 'medium',
      encryptedKey: existingJob.encrypted_api_key,
      keyIv: existingJob.key_iv,
      keyAuthTag: existingJob.key_auth_tag,
      userRca: edited_rca,
      regeneration: true,
      imageUrls: image_urls || [],
      screenshotsBase64: screenshots_base64 || [],
    });

    console.log(`[regenerate] ✅ Workflow triggered successfully`);

    return NextResponse.json({
      success: true,
      message: "Code regeneration started with edited RCA",
      job_id: job_id,
      regeneration_count: currentRegenCount + 1,
    });
  } catch (error) {
    console.error("[regenerate] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
