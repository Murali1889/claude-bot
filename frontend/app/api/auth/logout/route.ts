import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 *
 * Logout user and destroy session
 *
 * Security:
 * - Clears all session cookies
 * - Redirects to home page
 */
export async function POST(request: NextRequest) {
  try {
    // Destroy session (clears all cookies)
    await destroySession();

    return NextResponse.json(
      {
        success: true,
        message: "Logged out successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Failed to logout" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/logout
 *
 * Alternative logout endpoint for direct navigation
 */
export async function GET(request: NextRequest) {
  try {
    await destroySession();

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/`);
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/`);
  }
}
