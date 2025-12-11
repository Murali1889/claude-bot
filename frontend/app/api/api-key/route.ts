import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { encrypt } from "@/lib/encryption";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { installationId, apiKey, keyType } = await request.json();

    if (!installationId || !apiKey) {
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

    // Get installation and verify ownership
    const { data: installation, error: installError } = await supabase
      .from("installations")
      .select("*, users:user_id(*)")
      .eq("installation_id", installationId)
      .single();

    if (installError || !installation) {
      return NextResponse.json(
        { success: false, error: "Installation not found" },
        { status: 404 }
      );
    }

    // Verify user owns this installation or is member of org
    const isOwner =
      installation.users?.github_user_id === parseInt(githubUserId);

    if (!isOwner && installation.account_type === "User") {
      return NextResponse.json(
        { success: false, error: "You don't have access to this installation" },
        { status: 403 }
      );
    }

    // Encrypt the API key
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (!encryptionKey) {
      console.error("ENCRYPTION_KEY not set");
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const { encrypted, iv, authTag } = encrypt(apiKey, encryptionKey);

    // Store prefix for identification
    const keyPrefix = apiKey.substring(0, 15) + "...";

    // Get or create user record
    let userId = installation.user_id;

    if (!userId) {
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("github_user_id", parseInt(githubUserId))
        .single();

      userId = user?.id;

      // Link user to installation
      if (userId) {
        await supabase
          .from("installations")
          .update({ user_id: userId })
          .eq("installation_id", installationId);
      }
    }

    // Save encrypted API key
    const { error: saveError } = await supabase.from("api_keys").upsert(
      {
        installation_id: parseInt(installationId),
        user_id: userId,
        encrypted_key: encrypted,
        key_iv: iv,
        key_auth_tag: authTag,
        key_prefix: keyPrefix,
        key_type: keyType || "api_key",
        key_status: "active",
        failure_count: 0,
        last_validated_at: new Date().toISOString(),
      },
      { onConflict: "installation_id" }
    );

    if (saveError) {
      console.error("Error saving API key:", saveError);
      return NextResponse.json(
        { success: false, error: "Failed to save API key" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save API key error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const installationId = request.nextUrl.searchParams.get("installation_id");

    if (!installationId) {
      return NextResponse.json(
        { success: false, error: "Missing installation_id" },
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

    // Get API key status (not the actual key)
    const { data: apiKey, error } = await supabase
      .from("api_keys")
      .select("key_prefix, key_status, key_type, last_validated_at")
      .eq("installation_id", installationId)
      .single();

    if (error || !apiKey) {
      return NextResponse.json({
        success: true,
        hasKey: false,
      });
    }

    return NextResponse.json({
      success: true,
      hasKey: true,
      keyPrefix: apiKey.key_prefix,
      keyStatus: apiKey.key_status,
      keyType: apiKey.key_type,
      lastValidated: apiKey.last_validated_at,
    });
  } catch (error) {
    console.error("Get API key status error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
