import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { storeInstallation } from "@/lib/installation-service";
import { App } from "@octokit/app";

export const dynamic = "force-dynamic";

/**
 * POST /api/installations/capture
 *
 * Captures installation from GitHub redirect and stores in database
 * Called when user installs GitHub App and is redirected to setup page
 *
 * This replaces the need for webhooks for installation tracking
 *
 * Request body:
 * {
 *   "installation_id": "12345678",
 *   "setup_action": "install" | "update"
 * }
 *
 * Security:
 * - Requires authentication (session cookie)
 * - Fetches installation details from GitHub to verify
 * - Links installation to authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Please login first" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { installation_id, setup_action } = body;

    if (!installation_id) {
      return NextResponse.json(
        { error: "Missing installation_id" },
        { status: 400 }
      );
    }

    const installationId = parseInt(installation_id, 10);

    if (isNaN(installationId)) {
      return NextResponse.json(
        { error: "Invalid installation_id" },
        { status: 400 }
      );
    }

    // Verify GitHub App credentials
    const appId = process.env.APP_ID;
    const privateKey = process.env.PRIVATE_KEY;

    if (!appId || !privateKey) {
      return NextResponse.json(
        { error: "GitHub App not configured" },
        { status: 500 }
      );
    }

    // Create GitHub App instance
    const app = new App({
      appId,
      privateKey,
    });

    // Fetch installation details from GitHub to verify it exists
    let installation;
    try {
      const { data } = await app.octokit.request(
        "GET /app/installations/{installation_id}",
        {
          installation_id: installationId,
        }
      );
      installation = data;
    } catch (error: any) {
      console.error("Error fetching installation from GitHub:", error);

      if (error.status === 404) {
        return NextResponse.json(
          {
            error: "Installation not found on GitHub",
            details:
              "The installation may have been deleted or you may not have access to it",
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to verify installation with GitHub",
          details: error.message,
        },
        { status: 500 }
      );
    }

    // Verify the authenticated user owns this installation
    if (installation.account?.id !== user.github_user_id) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message:
            "You do not own this installation. Please login with the correct GitHub account.",
        },
        { status: 403 }
      );
    }

    // Handle both User and Organization account types
    const account = installation.account;
    const accountLogin = account
      ? "login" in account
        ? account.login
        : account.slug
      : "";
    const accountType = account
      ? "login" in account
        ? "User"
        : "Organization"
      : "User";

    // Store installation in database
    try {
      await storeInstallation(
        {
          installation_id: installationId,
          account_login: accountLogin,
          account_type: accountType,
          account_id: installation.account?.id || 0,
          repository_selection: installation.repository_selection || "all",
        },
        user.id
      );
    } catch (error) {
      console.error("Error storing installation:", error);
      return NextResponse.json(
        {
          error: "Failed to store installation in database",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    // Success!
    return NextResponse.json(
      {
        success: true,
        message: "Installation captured successfully",
        installation: {
          id: installationId,
          account_login: accountLogin,
          account_type: accountType,
          repository_selection: installation.repository_selection,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error capturing installation:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
