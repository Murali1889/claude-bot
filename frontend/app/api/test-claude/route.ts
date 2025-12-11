import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { decrypt } from "@/lib/encryption";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { installationId, problemDescription } = await request.json();

    if (!installationId || !problemDescription) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const githubUserId = request.cookies.get("github_user_id")?.value;

    if (!githubUserId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    // Get API key for this installation
    const { data: apiKeyData, error: keyError } = await supabase
      .from("api_keys")
      .select("encrypted_key, key_iv, key_auth_tag, key_type")
      .eq("installation_id", installationId)
      .single();

    if (keyError || !apiKeyData) {
      return NextResponse.json(
        { success: false, error: "API key not configured. Please save your API key first." },
        { status: 400 }
      );
    }

    // Decrypt the API key
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (!encryptionKey) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const apiKey = decrypt(
      apiKeyData.encrypted_key,
      apiKeyData.key_iv,
      apiKeyData.key_auth_tag,
      encryptionKey
    );

    // Call Anthropic API directly to test
    const headers: Record<string, string> = {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    };

    // Use appropriate auth header based on key type
    if (apiKeyData.key_type === "oauth_token") {
      headers["Authorization"] = `Bearer ${apiKey}`;
    } else {
      headers["x-api-key"] = apiKey;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `You are a helpful coding assistant. A user has described the following problem they want help with:

${problemDescription}

Please provide a helpful response. If this is a coding issue, suggest potential solutions or debugging steps. Keep your response concise but helpful.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 401) {
        return NextResponse.json(
          { success: false, error: "API key is invalid or expired. Please update your API key." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, error: errorData.error?.message || `API error: ${response.status}` },
        { status: 400 }
      );
    }

    const data = await response.json();
    const assistantMessage = data.content?.[0]?.text || "No response received";

    return NextResponse.json({
      success: true,
      response: assistantMessage,
      model: data.model,
      usage: data.usage,
    });
  } catch (error) {
    console.error("Test Claude error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to test API" },
      { status: 500 }
    );
  }
}
