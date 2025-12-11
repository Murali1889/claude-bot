import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { code, installation_id } = await request.json();

    if (!code || !installation_id) {
      return NextResponse.json(
        { success: false, error: "Missing code or installation_id" },
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
          client_id: process.env.GITHUB_APP_CLIENT_ID,
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

    // Verify user owns the installation
    const supabase = createServerClient();

    // Get installation from database
    const { data: installation, error: installError } = await supabase
      .from("installations")
      .select("*, users:user_id(*)")
      .eq("installation_id", installation_id)
      .single();

    if (installError || !installation) {
      return NextResponse.json(
        { success: false, error: "Installation not found" },
        { status: 404 }
      );
    }

    // Check if user matches
    if (installation.users && installation.users.github_user_id !== userData.id) {
      // Check if user is a member of the organization (for org installations)
      if (installation.account_type === "Organization") {
        // For org installations, verify user has access
        const orgResponse = await fetch(
          `https://api.github.com/orgs/${installation.account_login}/members/${userData.login}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github+json",
            },
          }
        );

        if (orgResponse.status !== 204) {
          return NextResponse.json(
            { success: false, error: "You don't have access to this installation" },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: "You don't own this installation" },
          { status: 403 }
        );
      }
    }

    // Update or create user in database
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

    // Link user to installation if not linked
    if (!installation.user_id && user) {
      await supabase
        .from("installations")
        .update({ user_id: user.id })
        .eq("installation_id", installation_id);
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

    // Set a session cookie (simple approach - in production use proper session management)
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
