import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/integrations/accounts
 * Returns connected accounts for the current user (without tokens).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("fp_connected_accounts")
      .select(
        "id, provider, provider_user_id, provider_workspace_id, display_label, scopes, status, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[integrations/accounts] Query error:", error.message);
      return NextResponse.json(
        { error: "Failed to fetch accounts" },
        { status: 500 }
      );
    }

    return NextResponse.json({ accounts: data ?? [] });
  } catch (err) {
    console.error("[integrations/accounts] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
