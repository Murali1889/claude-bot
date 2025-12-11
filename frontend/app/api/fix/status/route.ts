import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * POST /api/fix/status
 *
 * Update fix job status during workflow execution
 * Called by GitHub Actions workflow to report progress
 *
 * Request body:
 * {
 *   "job_id": string,
 *   "status": "rca_started" | "rca_completed" | "documentation_checked" | "code_changes_started" | "code_changes_completed" | "pr_created" | "completed" | "failed",
 *   "rca"?: string,  // Markdown RCA content
 *   "codebase_doc"?: string,  // code_base.md content
 *   "pr_url"?: string,
 *   "pr_number"?: number,
 *   "branch_name"?: string,
 *   "files_changed"?: string[],
 *   "error_message"?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { job_id, status, rca, codebase_doc, pr_url, pr_number, branch_name, files_changed, error_message } = body;

    // Validate required fields
    if (!job_id || !status) {
      return NextResponse.json(
        { error: "Missing required fields: job_id, status" },
        { status: 400 }
      );
    }

    console.log(`[Status Update] Job ${job_id}: ${status}`);

    const supabase = createServerClient();

    // Build update object based on status
    const updateData: any = {
      status: status,
      updated_at: new Date().toISOString(),
    };

    // Add phase-specific data
    if (status === "rca_completed" && rca) {
      updateData.rca = rca;
    }

    if (status === "documentation_checked" && codebase_doc) {
      updateData.codebase_documentation = codebase_doc;
    }

    if (status === "code_changes_started") {
      updateData.started_at = new Date().toISOString();
    }

    if (status === "pr_created" || status === "completed") {
      updateData.completed_at = new Date().toISOString();
      if (pr_url) updateData.pr_url = pr_url;
      if (pr_number) updateData.pr_number = pr_number;
      if (branch_name) updateData.branch_name = branch_name;
      if (files_changed) updateData.files_changed = files_changed;
    }

    if (status === "failed" && error_message) {
      updateData.error_message = error_message;
      updateData.completed_at = new Date().toISOString();
    }

    // Update the job
    const { error: updateError } = await supabase
      .from("fix_jobs")
      .update(updateData)
      .eq("id", job_id);

    if (updateError) {
      console.error(`[Status Update] Error updating job ${job_id}:`, updateError);
      return NextResponse.json(
        { error: "Failed to update job status", details: updateError.message },
        { status: 500 }
      );
    }

    console.log(`[Status Update] ✅ Job ${job_id} updated to ${status}`);

    return NextResponse.json({
      success: true,
      message: `Job status updated to ${status}`,
      job_id,
      status,
    });
  } catch (error) {
    console.error("[Status Update] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
