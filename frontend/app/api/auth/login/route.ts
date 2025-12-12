import { NextRequest, NextResponse } from "next/server";
import { generateToken } from "@/lib/auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * Initiate GitHub OAuth login flow
 * Generates state token for CSRF protection
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

    if (!clientId) {
      return NextResponse.json(
        { error: "GitHub OAuth not configured" },
        { status: 500 }
      );
    }

    // Get callback URL from query params (for post-login redirect)
    const { searchParams } = new URL(request.url);
    const callbackUrl = searchParams.get("callback");

    // Generate random state for CSRF protection
    const state = generateToken();

    // Store state in cookie (httpOnly for security)
    const cookieStore = cookies();
    cookieStore.set("oauth_state", state, {
      maxAge: 60 * 10, // 10 minutes
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    // Store callback URL in cookie if provided
    if (callbackUrl) {
      cookieStore.set("oauth_callback", callbackUrl, {
        maxAge: 60 * 10, // 10 minutes
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
    }

    // Build GitHub OAuth URL
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;
    const scope = "read:user user:email";

    const githubAuthUrl = new URL("https://github.com/login/oauth/authorize");
    githubAuthUrl.searchParams.set("client_id", clientId);
    githubAuthUrl.searchParams.set("redirect_uri", redirectUri);
    githubAuthUrl.searchParams.set("scope", scope);
    githubAuthUrl.searchParams.set("state", state);

    return NextResponse.redirect(githubAuthUrl.toString());
  } catch (error) {
    console.error("Login initiation error:", error);
    return NextResponse.json(
      { error: "Failed to initiate login" },
      { status: 500 }
    );
  }
}
