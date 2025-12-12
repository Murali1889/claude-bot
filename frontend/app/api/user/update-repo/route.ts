import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * POST /api/user/update-repo
 *
 * Updates the user's preferred git repository
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { gitrepo } = await request.json();

    if (!gitrepo) {
      return NextResponse.json(
        { error: "Repository is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { error } = await supabase
      .from("users")
      .update({ gitrepo, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      console.error("Error updating gitrepo:", error);
      return NextResponse.json(
        { error: "Failed to update repository" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Repository updated successfully",
      gitrepo,
    });
  } catch (error) {
    console.error("Error in update-repo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/update-repo
 *
 * Gets the user's current git repository preference
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("users")
      .select("gitrepo")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching gitrepo:", error);
      return NextResponse.json(
        { error: "Failed to fetch repository" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      gitrepo: data?.gitrepo || null,
    });
  } catch (error) {
    console.error("Error in update-repo GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
