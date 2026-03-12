import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchGitHubItems } from "@/lib/integrations/github";
import type { IntegrationScope } from "@/lib/integrations/types";

/**
 * GET /api/integrations/github/items
 * Returns assigned GitHub issues and PRs for the authenticated user.
 * Filters by enabled repo scopes.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the provider token from the session
    const providerToken = session.provider_token;
    if (!providerToken) {
      return NextResponse.json(
        { error: "No GitHub token available. Try reconnecting GitHub." },
        { status: 401 }
      );
    }

    // Fetch enabled scopes for this user's GitHub connection
    const { data: account } = await supabase
      .from("fp_connected_accounts")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("provider", "github")
      .single();

    let scopes: IntegrationScope[] = [];
    if (account) {
      const { data: scopeData } = await supabase
        .from("fp_integration_scopes")
        .select("*")
        .eq("connected_account_id", account.id);
      scopes = (scopeData ?? []) as IntegrationScope[];
    }

    const items = await fetchGitHubItems(providerToken, scopes);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[github/items] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch GitHub items" },
      { status: 500 }
    );
  }
}
