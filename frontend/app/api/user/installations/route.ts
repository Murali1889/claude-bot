import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Get user from cookies
    const githubUserId = request.cookies.get("github_user_id")?.value;

    if (!githubUserId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    // Get user's installations
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("github_user_id", parseInt(githubUserId))
      .single();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Fetch installations for this user
    const { data: installations, error } = await supabase
      .from("installations")
      .select("installation_id, account_login, account_type")
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      installations: installations || [],
    });
  } catch (error: any) {
    console.error("Fetch installations error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch installations"
      },
      { status: 500 }
    );
  }
}
