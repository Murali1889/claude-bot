import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { executeFix } from "@/lib/executor-service-workflow";

export const dynamic = "force-dynamic";

/**
 * POST /api/fix/execute
 *
 * Execute Claude Code CLI to fix a problem in a repository
 *
 * Security:
 * - Requires authentication
 * - Verifies user owns installation
 * - Verifies Claude token is configured
 * - Creates fix_job in database
 * - Queues execution (runs asynchronously)
 *
 * Request body:
 * {
 *   "installation_id": number,
 *   "repository_id": number,
 *   "repository_full_name": string,
 *   "problem_statement": string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body first
    const body = await request.json();

    // Check for API key authentication (for programmatic access)
    const authApiKey = request.headers.get("x-api-key");
    const validApiKey = process.env.API_SECRET_KEY;

    let userId: string;

    if (authApiKey && validApiKey && authApiKey === validApiKey) {
      // API key authentication - get user_id from request body
      if (!body.user_id) {
        return NextResponse.json(
          { error: "user_id is required when using API key authentication" },
          { status: 400 }
        );
      }
      userId = body.user_id;
    } else {
      // Session-based authentication
      const user = await getSessionUser();
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized - Please login first or provide valid API key" },
          { status: 401 }
        );
      }
      userId = user.id;
    }

    // Continue with request body parsing
    const {
      installation_id,
      repository_id,
      repository_full_name,
      problem_statement,
    } = body;

    // Validate required fields
    if (
      !installation_id ||
      !repository_id ||
      !repository_full_name ||
      !problem_statement
    ) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: [
            "installation_id",
            "repository_id",
            "repository_full_name",
            "problem_statement",
          ],
        },
        { status: 400 }
      );
    }

    // Validate problem statement length
    if (problem_statement.trim().length < 10) {
      return NextResponse.json(
        { error: "Problem statement too short (minimum 10 characters)" },
        { status: 400 }
      );
    }

    if (problem_statement.length > 5000) {
      return NextResponse.json(
        { error: "Problem statement too long (maximum 5000 characters)" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Verify installation exists and user owns it
    console.log("Looking up installation_id:", installation_id, "type:", typeof installation_id);
    const { data: installation, error: installError } = await supabase
      .from("installations")
      .select("user_id, installation_id")
      .eq("installation_id", installation_id)
      .single();

    console.log("Installation lookup result:", { installation, installError });

    if (installError || !installation) {
      console.error("Installation not found:", installError);
      return NextResponse.json(
        {
          error: "Installation not found",
          details: installError?.message,
          installation_id: installation_id
        },
        { status: 404 }
      );
    }

    if (installation.user_id !== userId) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You do not own this installation",
        },
        { status: 403 }
      );
    }

    // Verify Claude token is configured for this installation
    // Get encrypted key data so we can pass it to executeFix
    const { data: apiKey, error: keyError } = await supabase
      .from("api_keys")
      .select("id, key_status, encrypted_key, key_iv, key_auth_tag")
      .eq("installation_id", installation_id)
      .single();

    if (keyError || !apiKey) {
      return NextResponse.json(
        {
          error: "Claude token not configured",
          message:
            "Please configure your Claude Code token in Settings before creating fixes.",
          action: "configure_token",
        },
        { status: 400 }
      );
    }

    if (apiKey.key_status !== "active") {
      return NextResponse.json(
        {
          error: "Claude token is not active",
          message: "Your token may be invalid or expired. Please update it in Settings.",
          action: "configure_token",
        },
        { status: 400 }
      );
    }

    // Extract repository name from full_name
    const repoName = repository_full_name.split("/")[1] || repository_full_name;

    // Create fix_job in database
    const { data: job, error: jobError } = await supabase
      .from("fix_jobs")
      .insert({
        user_id: userId,
        installation_id: installation_id,
        repository_id: repository_id,
        repository_name: repoName,
        repository_full_name: repository_full_name,
        problem_statement: problem_statement.trim(),
        status: "pending",
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("Error creating fix job:", jobError);
      return NextResponse.json(
        {
          error: "Failed to create fix job",
          details: jobError?.message,
        },
        { status: 500 }
      );
    }

    // Execute fix asynchronously (don't wait for completion)
    // Pass all needed data to avoid database queries in the background function
    executeFix({
      jobId: job.id,
      installationId: installation_id,
      repositoryFullName: repository_full_name,
      problemStatement: problem_statement.trim(),
      encryptedKey: apiKey.encrypted_key,
      keyIv: apiKey.key_iv,
      keyAuthTag: apiKey.key_auth_tag,
    }).catch((error) => {
      console.error(`Error executing fix job ${job.id}:`, error);
    });

    // Return job immediately
    return NextResponse.json(
      {
        success: true,
        message: "Fix job created successfully",
        job: {
          id: job.id,
          repository_full_name: job.repository_full_name,
          problem_statement: job.problem_statement,
          status: job.status,
          created_at: job.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in /api/fix/execute:", error);
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
