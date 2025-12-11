import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * POST /api/fix/webhook
 *
 * Webhook endpoint called by the worker workflow
 * Updates job status when workflow completes
 *
 * Security:
 * - Should validate webhook signature in production
 * - For now, validates job_id exists in database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { job_id, status, pr_url, pr_number, branch_name, error_message } =
      body;

    if (!job_id || !status) {
      return NextResponse.json(
        { error: "Missing required fields: job_id, status" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Verify job exists
    const { data: job, error: jobError } = await supabase
      .from("fix_jobs")
      .select("id, status")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Update job with workflow results
    const updates: any = {
      status,
      completed_at: new Date().toISOString(),
    };

    if (pr_url) updates.pr_url = pr_url;
    if (pr_number) updates.pr_number = pr_number;
    if (branch_name) updates.branch_name = branch_name;
    if (error_message) updates.error_message = error_message;

    if (status === "completed") {
      updates.execution_log = `Successfully created PR #${pr_number}`;
    }

    const { error: updateError } = await supabase
      .from("fix_jobs")
      .update(updates)
      .eq("id", job_id);

    if (updateError) {
      console.error("Error updating job:", updateError);
      return NextResponse.json(
        { error: "Failed to update job" },
        { status: 500 }
      );
    }

    console.log(`Job ${job_id} updated: ${status}`);

    return NextResponse.json(
      {
        success: true,
        message: "Job updated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
