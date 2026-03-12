import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import type { IntegrationProviderId } from "@/lib/integrations/types";

/**
 * POST /api/integrations/disconnect
 * Disconnects a provider: deletes connected account + cascades to scopes.
 * Optionally unlinks the Supabase identity.
 */
export async function POST(request: Request) {
  try {
    const { provider } = (await request.json()) as {
      provider: IntegrationProviderId;
    };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete the connected account (cascades to scopes via FK)
    const admin = createAdminClient();
    const { error } = await admin
      .from("fp_connected_accounts")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider);

    if (error) {
      console.error(`[integrations/disconnect] Delete error:`, error.message);
      return NextResponse.json(
        { error: "Failed to disconnect" },
        { status: 500 }
      );
    }

    // Optionally unlink the Supabase identity
    // Only do this if the user has more than one identity (don't lock them out)
    const identityProviderMap: Record<string, string> = {
      github: "github",
      google: "google",
      linear: "linear",
      slack: "slack_oidc",
      discord: "discord",
    };

    const identityProvider = identityProviderMap[provider];
    const identity = user.identities?.find(
      (i) => i.provider === identityProvider
    );

    if (identity && (user.identities?.length ?? 0) > 1) {
      const { error: unlinkError } = await supabase.auth.unlinkIdentity(identity);
      if (unlinkError) {
        // Non-fatal — account row is already deleted
        console.warn(
          `[integrations/disconnect] Could not unlink identity:`,
          unlinkError.message
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[integrations/disconnect] Error:", err);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
