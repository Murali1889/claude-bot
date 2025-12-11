import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const installationId = request.nextUrl.searchParams.get("installation_id");

    if (!installationId) {
      return NextResponse.json({ exists: false, error: "Missing installation_id" });
    }

    const supabase = createServerClient();

    const { data: installation, error } = await supabase
      .from("installations")
      .select("installation_id, account_login, account_type")
      .eq("installation_id", installationId)
      .single();

    if (error || !installation) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
      account: installation.account_login,
      accountType: installation.account_type,
    });
  } catch (error) {
    console.error("Installation verify error:", error);
    return NextResponse.json({ exists: false, error: "Server error" });
  }
}
