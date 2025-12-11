import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { createServerClient } from "@/lib/supabase";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { apiKey, problemDescription, repoFullName } = await request.json();

    if (!apiKey || !problemDescription || !repoFullName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate repo format (owner/repo)
    if (!repoFullName.includes("/")) {
      return NextResponse.json(
        { success: false, error: "Repository must be in format: owner/repo" },
        { status: 400 }
      );
    }

    const [owner, repo] = repoFullName.split("/");

    // Initialize GitHub App
    const { App } = await import("@octokit/app");
    const app = new App({
      appId: parseInt(process.env.APP_ID!, 10),
      privateKey: process.env.PRIVATE_KEY!.replace(/\\n/g, '\n'),
    });

    // Get all installations and find the one for this owner
    const { data: installations } = await app.octokit.request("GET /app/installations");
    const installation = installations.find(
      (inst: any) => inst.account.login.toLowerCase() === owner.toLowerCase()
    );

    if (!installation) {
      return NextResponse.json(
        { success: false, error: `GitHub App not installed on ${owner}. Please install it first.` },
        { status: 404 }
      );
    }

    const supabase = createServerClient();

    // Save or update installation in database for future webhook use
    const { data: existingInstallation } = await supabase
      .from("installations")
      .select("*")
      .eq("installation_id", installation.id)
      .single();

    let userId = existingInstallation?.user_id;

    if (!existingInstallation) {
      // Ensure account exists
      if (!installation.account) {
        return NextResponse.json(
          { success: false, error: "Installation account data not available" },
          { status: 500 }
        );
      }

      // Create a dummy user record if needed (for testing)
      const { data: user } = await supabase
        .from("users")
        .upsert(
          {
            github_user_id: installation.account.id,
            github_username: installation.account.login,
          },
          { onConflict: "github_user_id" }
        )
        .select()
        .single();

      userId = user?.id;

      // Save installation to database
      await supabase.from("installations").upsert(
        {
          installation_id: installation.id,
          user_id: userId,
          account_id: installation.account.id,
          account_login: installation.account.login,
          account_type: installation.account.type,
        },
        { onConflict: "installation_id" }
      );
    }

    // Save the API key (will be used by webhook)
    const { encrypt } = await import("@/lib/encryption");
    const encryptionKey = process.env.ENCRYPTION_KEY!;
    const { encrypted, iv, authTag } = encrypt(apiKey, encryptionKey);

    await supabase.from("api_keys").upsert(
      {
        installation_id: installation.id,
        user_id: userId,
        encrypted_key: encrypted,
        key_iv: iv,
        key_auth_tag: authTag,
        key_prefix: apiKey.substring(0, 15) + "...",
        key_type: "oauth_token",
        key_status: "active",
        last_validated_at: new Date().toISOString(),
      },
      { onConflict: "installation_id" }
    );

    // Use GitHub App to create issue (triggers webhook automatically)
    const octokit = await app.getInstallationOctokit(installation.id);

    // Create the issue with @claude mention using request API
    const { data: issue } = await octokit.request("POST /repos/{owner}/{repo}/issues", {
      owner,
      repo,
      title: `Test: ${problemDescription.substring(0, 60)}`,
      body: `@claude ${problemDescription}\n\n---\n*Created from test page*`,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    return NextResponse.json({
      success: true,
      message: "Issue created! Webhook triggered. Check your repo for the PR.",
      issueUrl: issue.html_url,
      issueNumber: issue.number,
    });
  } catch (error: any) {
    console.error("Trigger workflow error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create issue"
      },
      { status: 500 }
    );
  }
}
