import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PROVIDERS } from "@/lib/integrations/providers";
import type { IntegrationProviderId } from "@/lib/integrations/types";

/**
 * POST /api/integrations/connect
 * Initiates OAuth linking for a provider.
 * Returns the OAuth URL for the client to redirect to.
 */
export async function POST(request: Request) {
  try {
    const { provider } = (await request.json()) as {
      provider: IntegrationProviderId;
    };

    const providerDef = PROVIDERS[provider];
    if (!providerDef) {
      return NextResponse.json(
        { error: `Unknown provider: ${provider}` },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Map our provider IDs to Supabase OAuth provider names
    const supabaseProviderMap: Record<string, string> = {
      github: "github",
      google: "google",
      linear: "linear",
      slack: "slack_oidc",
      discord: "discord",
    };

    const supabaseProvider = supabaseProviderMap[provider];
    if (!supabaseProvider) {
      return NextResponse.json(
        { error: `OAuth not configured for ${provider}` },
        { status: 400 }
      );
    }

    // Build the redirect URL for the callback
    const origin = new URL(request.url).origin;
    const redirectTo = `${origin}/api/integrations/callback?provider=${provider}`;

    const { data, error } = await supabase.auth.linkIdentity({
      provider: supabaseProvider as "github" | "google" | "discord",
      options: {
        redirectTo,
        scopes: providerDef.defaultScopes.join(" "),
      },
    });

    if (error) {
      console.error(`[integrations/connect] OAuth error for ${provider}:`, error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.url });
  } catch (err) {
    console.error("[integrations/connect] Error:", err);
    return NextResponse.json(
      { error: "Failed to initiate connection" },
      { status: 500 }
    );
  }
}
