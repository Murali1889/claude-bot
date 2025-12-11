import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/fix/status/[id]
 *
 * Get the status of a fix job
 *
 * Security:
 * - Requires authentication
 * - Only returns jobs owned by the authenticated user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const jobId = params.id;

    if (!jobId) {
      return NextResponse.json(
        { error: "Missing job ID" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Get job with ownership verification
    const { data: job, error } = await supabase
      .from("fix_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id) // Verify ownership
      .single();

    if (error || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        job: {
          id: job.id,
          repository_full_name: job.repository_full_name,
          problem_statement: job.problem_statement,
          status: job.status,
          started_at: job.started_at,
          completed_at: job.completed_at,
          branch_name: job.branch_name,
          pr_number: job.pr_number,
          pr_url: job.pr_url,
          error_message: job.error_message,
          created_at: job.created_at,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in /api/fix/status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
