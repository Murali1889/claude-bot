/**
 * Installation Service
 * Handles GitHub App installations and repository access
 *
 * Security Features:
 * - JWT authentication with GitHub App
 * - Installation access tokens (short-lived)
 * - Owner verification before accessing data
 */

import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";
import { createServerClient } from "./supabase";

// Types
export interface Installation {
  id: number;
  account: {
    login: string;
    type: string;
    avatar_url: string;
    id: number;
  };
  repository_selection: "all" | "selected";
  created_at: string;
  updated_at: string;
  suspended_at: string | null;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  updated_at: string;
}

/**
 * Create GitHub App instance with credentials
 */
function createGitHubApp(): App {
  const appId = process.env.APP_ID;
  const privateKey = process.env.PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("GitHub App credentials not configured");
  }

  return new App({
    appId,
    privateKey,
  });
}

/**
 * Get installations for a specific user
 * Uses GitHub App to fetch all installations and filter by user
 *
 * @param githubUserId - The GitHub user ID
 * @returns List of installations
 */
export async function getUserInstallations(
  githubUserId: number
): Promise<Installation[]> {
  try {
    const app = createGitHubApp();

    // Collect all installations using the async iterator
    const allInstallations: any[] = [];

    for await (const { installation } of app.eachInstallation.iterator()) {
      allInstallations.push(installation);
    }

    // Filter to only installations this user owns
    const userInstallations = allInstallations.filter((installation) => {
      return installation.account?.id === githubUserId;
    });

    return userInstallations.map((inst) => ({
      id: inst.id,
      account: {
        login: inst.account?.login || "",
        type: inst.account?.type || "User",
        avatar_url: inst.account?.avatar_url || "",
        id: inst.account?.id || 0,
      },
      repository_selection: inst.repository_selection as "all" | "selected",
      created_at: inst.created_at || new Date().toISOString(),
      updated_at: inst.updated_at || new Date().toISOString(),
      suspended_at: inst.suspended_at || null,
    }));
  } catch (error) {
    console.error("Error fetching user installations:", error);
    throw new Error("Failed to fetch installations");
  }
}

/**
 * Get repositories for a specific installation
 *
 * Security: Verifies the user owns this installation before returning data
 *
 * @param installationId - The installation ID
 * @param githubUserId - The GitHub user ID (for ownership verification)
 * @returns List of repositories
 */
export async function getInstallationRepositories(
  installationId: number,
  githubUserId: number
): Promise<Repository[]> {
  try {
    const app = createGitHubApp();

    // Get installation to verify ownership
    const { data: installation } = await app.octokit.request(
      "GET /app/installations/{installation_id}",
      {
        installation_id: installationId,
      }
    );

    // Verify user owns this installation
    if (installation.account?.id !== githubUserId) {
      throw new Error("Unauthorized: User does not own this installation");
    }

    // Create installation access token (short-lived, 1 hour)
    const installationOctokit = await app.getInstallationOctokit(installationId);

    // Fetch repositories
    const { data } = await installationOctokit.request(
      "GET /installation/repositories",
      {
        per_page: 100,
      }
    );

    return data.repositories.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      html_url: repo.html_url,
      description: repo.description,
      language: repo.language,
      updated_at: repo.updated_at || new Date().toISOString(),
    }));
  } catch (error) {
    console.error("Error fetching installation repositories:", error);
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      throw error;
    }
    throw new Error("Failed to fetch repositories");
  }
}

/**
 * Store installation in database
 * Called when installation.created webhook is received
 *
 * @param installationData - Installation data from webhook
 * @param userId - User ID from database
 */
export async function storeInstallation(
  installationData: {
    installation_id: number;
    account_login: string;
    account_type: string;
    account_id: number;
    repository_selection?: string;
  },
  userId: string
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase.from("installations").upsert(
    {
      installation_id: installationData.installation_id,
      user_id: userId,
      account_login: installationData.account_login,
      account_type: installationData.account_type,
      account_id: installationData.account_id,
      repository_selection: installationData.repository_selection || "all",
    },
    { onConflict: "installation_id" }
  );

  if (error) {
    console.error("Error storing installation:", error);
    throw new Error("Failed to store installation");
  }
}

/**
 * Remove installation from database
 * Called when installation.deleted webhook is received
 *
 * @param installationId - The installation ID to remove
 */
export async function removeInstallation(
  installationId: number
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("installations")
    .delete()
    .eq("installation_id", installationId);

  if (error) {
    console.error("Error removing installation:", error);
    throw new Error("Failed to remove installation");
  }
}

/**
 * Mark installation as suspended
 *
 * @param installationId - The installation ID
 */
export async function suspendInstallation(
  installationId: number
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("installations")
    .update({ suspended_at: new Date().toISOString() })
    .eq("installation_id", installationId);

  if (error) {
    console.error("Error suspending installation:", error);
    throw new Error("Failed to suspend installation");
  }
}

/**
 * Verify user owns an installation
 *
 * @param installationId - The installation ID
 * @param userId - The user ID from database
 * @returns true if user owns installation
 */
export async function verifyInstallationOwnership(
  installationId: number,
  userId: string
): Promise<boolean> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("installations")
    .select("user_id")
    .eq("installation_id", installationId)
    .single();

  if (error || !data) {
    return false;
  }

  return data.user_id === userId;
}

/**
 * Get installation from database
 *
 * @param installationId - The installation ID
 * @returns Installation data from database
 */
export async function getInstallationFromDB(installationId: number) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("installations")
    .select("*")
    .eq("installation_id", installationId)
    .single();

  if (error) {
    console.error("Error fetching installation:", error);
    return null;
  }

  return data;
}

/**
 * Get user ID from GitHub user ID
 *
 * @param githubUserId - GitHub user ID
 * @returns User ID from database
 */
export async function getUserIdFromGitHubId(
  githubUserId: number
): Promise<string | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("github_user_id", githubUserId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}
