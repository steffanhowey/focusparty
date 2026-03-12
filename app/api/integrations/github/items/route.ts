import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { fetchGitHubItems } from "@/lib/integrations/github";
import type { IntegrationScope } from "@/lib/integrations/types";

/**
 * GET /api/integrations/github/items
 * Returns assigned GitHub issues and PRs for the authenticated user.
 * Reads the GitHub access token from fp_connected_accounts (persisted during OAuth callback).
 * Filters by enabled repo scopes.
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

    // Read access token from fp_connected_accounts (stored during OAuth callback)
    const admin = createAdminClient();
    const { data: account } = await admin
      .from("fp_connected_accounts")
      .select("id, access_token")
      .eq("user_id", user.id)
      .eq("provider", "github")
      .eq("status", "active")
      .single();

    if (!account?.access_token) {
      // No connected GitHub account — return empty items, not an error
      return NextResponse.json({ items: [] });
    }

    // Fetch enabled scopes
    let scopes: IntegrationScope[] = [];
    const { data: scopeData } = await admin
      .from("fp_integration_scopes")
      .select("*")
      .eq("connected_account_id", account.id);
    scopes = (scopeData ?? []) as IntegrationScope[];

    const items = await fetchGitHubItems(account.access_token, scopes);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[github/items] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch GitHub items" },
      { status: 500 }
    );
  }
}
