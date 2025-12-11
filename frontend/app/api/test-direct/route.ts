import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { apiKey, keyType, problemDescription } = await request.json();

    if (!apiKey || !problemDescription) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Call Anthropic API directly
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
          { success: false, error: "API key is invalid or expired" },
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
    console.error("Test direct error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to test API" },
      { status: 500 }
    );
  }
}
