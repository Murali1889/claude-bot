import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { success: false, error: "Missing code" },
        { status: 400 }
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_APP_CLIENT_SECRET,
          code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return NextResponse.json(
        { success: false, error: tokenData.error_description || tokenData.error },
        { status: 400 }
      );
    }

    const accessToken = tokenData.access_token;

    // Get user info
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });

    const userData = await userResponse.json();

    if (!userData.id) {
      return NextResponse.json(
        { success: false, error: "Failed to get user info" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Create/update user in database
    const { data: user, error: userError } = await supabase
      .from("users")
      .upsert(
        {
          github_user_id: userData.id,
          github_username: userData.login,
          email: userData.email,
          avatar_url: userData.avatar_url,
        },
        { onConflict: "github_user_id" }
      )
      .select()
      .single();

    if (userError) {
      console.error("Error upserting user:", userError);
    }

    // Create session response with cookie
    const response = NextResponse.json({
      success: true,
      user: {
        login: userData.login,
        avatar_url: userData.avatar_url,
        id: userData.id,
      },
    });

    // Set session cookies
    response.cookies.set("github_user_id", String(userData.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    response.cookies.set("github_username", userData.login, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication failed" },
      { status: 500 }
    );
  }
}
