import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { apiKey, keyType } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { valid: false, error: "API key is required" },
        { status: 400 }
      );
    }

    // Validate format for API keys
    if (keyType === "api_key" && !apiKey.startsWith("sk-ant-")) {
      return NextResponse.json(
        { valid: false, error: 'API key should start with "sk-ant-"' },
        { status: 400 }
      );
    }

    // Test the key with Anthropic API
    const headers: Record<string, string> = {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    };

    // Use appropriate auth header based on key type
    if (keyType === "oauth_token") {
      headers["Authorization"] = `Bearer ${apiKey}`;
    } else {
      headers["x-api-key"] = apiKey;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (response.ok) {
      return NextResponse.json({ valid: true });
    }

    if (response.status === 401) {
      return NextResponse.json(
        { valid: false, error: "Invalid API key or token" },
        { status: 400 }
      );
    }

    if (response.status === 429) {
      // Rate limited but key is valid
      return NextResponse.json({
        valid: true,
        warning: "Rate limited - key appears valid",
      });
    }

    if (response.status === 400) {
      // Bad request but authenticated - key is valid
      return NextResponse.json({ valid: true });
    }

    const errorData = await response.json().catch(() => ({}));
    return NextResponse.json(
      {
        valid: false,
        error: errorData.error?.message || `Validation failed (${response.status})`,
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("API key validation error:", error);
    return NextResponse.json(
      { valid: false, error: "Network error during validation" },
      { status: 500 }
    );
  }
}
