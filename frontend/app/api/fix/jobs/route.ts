import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/fix/jobs
 *
 * Fetch all fix jobs for the current user
 *
 * Query params:
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 * - status: filter by status (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Please login first" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const statusFilter = searchParams.get("status");

    const supabase = createServerClient();

    // Build query
    let query = supabase
      .from("fix_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Add status filter if provided
    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data: jobs, error } = await query;

    if (error) {
      console.error("Error fetching jobs:", error);
      return NextResponse.json(
        { error: "Failed to fetch jobs", details: error.message },
        { status: 500 }
      );
    }

    // Count total jobs
    const { count } = await supabase
      .from("fix_jobs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      jobs: jobs || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error in /api/fix/jobs:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
