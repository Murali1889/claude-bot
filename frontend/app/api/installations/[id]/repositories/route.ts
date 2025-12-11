import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getInstallationRepositories } from "@/lib/installation-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/installations/[id]/repositories
 *
 * Fetch repositories for a specific GitHub App installation
 *
 * Security:
 * - Requires authentication (session cookie)
 * - Verifies user owns the installation before returning data
 * - Uses installation access token (short-lived) for GitHub API
 *
 * Parameters:
 * - id: Installation ID
 *
 * Response:
 * {
 *   "repositories": [
 *     {
 *       "id": 123,
 *       "name": "my-repo",
 *       "full_name": "username/my-repo",
 *       "private": false,
 *       "html_url": "https://github.com/username/my-repo",
 *       "description": "My repository",
 *       "language": "TypeScript",
 *       "updated_at": "2024-01-01T00:00:00Z"
 *     }
 *   ]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse installation ID
    const installationId = parseInt(params.id, 10);

    if (isNaN(installationId)) {
      return NextResponse.json(
        { error: "Invalid installation ID" },
        { status: 400 }
      );
    }

    // Fetch repositories (includes ownership verification)
    const repositories = await getInstallationRepositories(
      installationId,
      user.github_user_id
    );

    return NextResponse.json(
      {
        repositories,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching repositories:", error);

    // Handle unauthorized access
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You do not have access to this installation",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch repositories",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
