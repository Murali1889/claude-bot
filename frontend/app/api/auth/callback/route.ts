import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * Handle GitHub OAuth callback
 * Exchanges code for access token, creates user, and establishes session
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    // Validate required parameters
    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?error=missing_code`
      );
    }

    // Verify state token (CSRF protection)
    const cookieStore = cookies();
    const storedState = cookieStore.get("oauth_state")?.value;

    if (!state || !storedState || state !== storedState) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?error=invalid_state`
      );
    }

    // Delete state cookie (one-time use)
    cookieStore.delete("oauth_state");

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
      console.error("GitHub token exchange error:", tokenData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?error=token_exchange_failed`
      );
    }

    const accessToken = tokenData.access_token;

    // Fetch user info from GitHub
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    const userData = await userResponse.json();

    if (!userData.id) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?error=failed_to_get_user`
      );
    }

    // Create or update user in database
    const supabase = createServerClient();

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

    if (userError || !user) {
      console.error("Error creating user:", userError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?error=database_error`
      );
    }

    // Create secure session
    await createSession(user.id);

    // Check for callback URL from login flow
    const callbackUrl = cookieStore.get("oauth_callback")?.value;

    // Delete callback cookie (one-time use)
    if (callbackUrl) {
      cookieStore.delete("oauth_callback");
    }

    // Redirect to callback URL or default to dashboard
    const redirectUrl = callbackUrl || "/dashboard";
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${redirectUrl}`);
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?error=authentication_failed`
    );
  }
}
