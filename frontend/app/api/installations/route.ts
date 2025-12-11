import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getUserInstallations } from "@/lib/installation-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/installations
 *
 * Fetch all GitHub App installations for the authenticated user
 *
 * Security:
 * - Requires authentication (session cookie)
 * - Only returns installations owned by the authenticated user
 * - Uses GitHub App JWT for secure API access
 *
 * Response:
 * {
 *   "installations": [
 *     {
 *       "id": 12345,
 *       "account": {
 *         "login": "username",
 *         "type": "User",
 *         "avatar_url": "https://...",
 *         "id": 12345
 *       },
 *       "repository_selection": "all",
 *       "created_at": "2024-01-01T00:00:00Z",
 *       "updated_at": "2024-01-01T00:00:00Z",
 *       "suspended_at": null
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch installations from GitHub
    const installations = await getUserInstallations(user.github_user_id);

    return NextResponse.json(
      {
        installations,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching installations:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch installations",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
