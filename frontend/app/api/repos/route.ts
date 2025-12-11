import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Get installation_id from query params
    const installationId = request.nextUrl.searchParams.get("installation_id");

    if (!installationId) {
      return NextResponse.json(
        { success: false, error: "Missing installation_id" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Get installation from database
    const { data: installation, error: installError } = await supabase
      .from("installations")
      .select("*")
      .eq("installation_id", installationId)
      .single();

    if (installError || !installation) {
      return NextResponse.json(
        { success: false, error: "Installation not found" },
        { status: 404 }
      );
    }

    // For now, return the single repo from the installation
    // In production, you'd fetch all repos the installation has access to
    const repos = [{
      full_name: `${installation.account_login}/${installation.account_login}`, // Approximate
      name: installation.account_login,
    }];

    return NextResponse.json({
      success: true,
      repos: repos,
      installation: {
        account: installation.account_login,
        type: installation.account_type,
      }
    });
  } catch (error: any) {
    console.error("Fetch repos error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch repositories"
      },
      { status: 500 }
    );
  }
}
