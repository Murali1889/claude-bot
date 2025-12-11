import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const installationId = request.nextUrl.searchParams.get("installation_id");

    if (!installationId) {
      return NextResponse.json({ authenticated: false });
    }

    // Check for session cookies
    const githubUserId = request.cookies.get("github_user_id")?.value;
    const githubUsername = request.cookies.get("github_username")?.value;

    if (!githubUserId || !githubUsername) {
      return NextResponse.json({ authenticated: false });
    }

    // Verify user has access to this installation
    const supabase = createServerClient();

    const { data: installation } = await supabase
      .from("installations")
      .select("*, users:user_id(*)")
      .eq("installation_id", installationId)
      .single();

    if (!installation) {
      return NextResponse.json({ authenticated: false });
    }

    // Check if user owns this installation
    const isOwner =
      installation.users?.github_user_id === parseInt(githubUserId);

    // For org installations, we already verified membership during OAuth
    // For user installations, verify ownership
    if (!isOwner && installation.account_type === "User") {
      return NextResponse.json({ authenticated: false });
    }

    // Get user from database for avatar
    const { data: user } = await supabase
      .from("users")
      .select("avatar_url")
      .eq("github_user_id", parseInt(githubUserId))
      .single();

    return NextResponse.json({
      authenticated: true,
      user: {
        login: githubUsername,
        avatar_url: user?.avatar_url || `https://github.com/${githubUsername}.png`,
      },
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ authenticated: false });
  }
}
