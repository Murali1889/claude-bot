import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { encrypt } from "@/lib/encryption";

export const dynamic = "force-dynamic";

/**
 * POST /api/tokens/save
 *
 * Save encrypted Claude Code CLI token or Anthropic API key
 *
 * Security:
 * - Requires authentication
 * - Verifies user owns installation
 * - Encrypts token before storage using AES-256-GCM
 * - Validates token format
 *
 * Request body:
 * {
 *   "installation_id": number,
 *   "token": string,
 *   "token_type": "claude_code_token" | "anthropic_api_key"
 * }
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
    const { installation_id, token, token_type } = body;

    // Validate required fields
    if (!installation_id || !token) {
      return NextResponse.json(
        { error: "Missing required fields: installation_id, token" },
        { status: 400 }
      );
    }

    // Validate token type
    const validTokenTypes = ["claude_code_token", "anthropic_api_key"];
    if (!token_type || !validTokenTypes.includes(token_type)) {
      return NextResponse.json(
        {
          error: `Invalid token_type. Must be one of: ${validTokenTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate token format
    if (token_type === "anthropic_api_key" && !token.startsWith("sk-ant-")) {
      return NextResponse.json(
        {
          error: 'Anthropic API keys must start with "sk-ant-"',
          hint: "Please check your API key from console.anthropic.com",
        },
        { status: 400 }
      );
    }

    // Validate token length (basic security check)
    if (token.length < 20 || token.length > 500) {
      return NextResponse.json(
        { error: "Invalid token length" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Verify installation exists and user owns it
    const { data: installation, error: installError } = await supabase
      .from("installations")
      .select("user_id, installation_id")
      .eq("installation_id", installation_id)
      .single();

    if (installError || !installation) {
      return NextResponse.json(
        {
          error: "Installation not found",
          details: "Please install the GitHub App first",
        },
        { status: 404 }
      );
    }

    // Verify ownership
    if (installation.user_id !== user.id) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You do not own this installation",
        },
        { status: 403 }
      );
    }

    // Get encryption key from environment
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (!encryptionKey) {
      console.error("ENCRYPTION_KEY not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Encrypt the token
    const { encrypted, iv, authTag } = encrypt(token, encryptionKey);

    // Extract key prefix for identification (first 15 chars)
    const keyPrefix = token.substring(0, 15) + "...";

    // Save or update token in database
    const { data: savedKey, error: saveError } = await supabase
      .from("api_keys")
      .upsert(
        {
          installation_id: installation_id,
          user_id: user.id,
          encrypted_key: encrypted,
          key_iv: iv,
          key_auth_tag: authTag,
          key_prefix: keyPrefix,
          token_type: token_type,
          key_status: "active",
          failure_count: 0,
          last_validated_at: new Date().toISOString(),
        },
        { onConflict: "installation_id" }
      )
      .select()
      .single();

    if (saveError) {
      console.error("Error saving token:", saveError);
      return NextResponse.json(
        {
          error: "Failed to save token",
          details: saveError.message,
        },
        { status: 500 }
      );
    }

    // Success!
    return NextResponse.json(
      {
        success: true,
        message: "Token saved successfully",
        token_info: {
          token_type: token_type,
          key_prefix: keyPrefix,
          status: "active",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in /api/tokens/save:", error);
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

/**
 * GET /api/tokens/save
 *
 * Get token status for current user's installations
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    // Get all tokens for user's installations
    const { data: tokens, error } = await supabase
      .from("api_keys")
      .select(
        `
        id,
        installation_id,
        key_prefix,
        token_type,
        key_status,
        last_validated_at,
        created_at
      `
      )
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching tokens:", error);
      return NextResponse.json(
        { error: "Failed to fetch tokens" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        tokens: tokens || [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/tokens/save:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
