import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PROVIDERS } from "@/lib/integrations/providers";
import type { IntegrationProviderId } from "@/lib/integrations/types";
import crypto from "crypto";

/**
 * POST /api/integrations/connect
 * Builds a direct OAuth authorize URL for the requested provider.
 * Returns { url } for the client to redirect to.
 *
 * This bypasses Supabase auth's linkIdentity — we only need an access token
 * for API calls, not an identity link.
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

    // Verify user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const origin = new URL(request.url).origin;

    if (provider === "github") {
      const clientId = process.env.GITHUB_CLIENT_ID;
      if (!clientId) {
        return NextResponse.json(
          { error: "GitHub OAuth not configured (missing GITHUB_CLIENT_ID)" },
          { status: 500 }
        );
      }

      // Generate a random state parameter for CSRF protection
      // Encode the provider + user ID so the callback can verify
      const statePayload = JSON.stringify({
        provider,
        userId: user.id,
        nonce: crypto.randomBytes(16).toString("hex"),
      });
      const state = Buffer.from(statePayload).toString("base64url");

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${origin}/api/integrations/callback`,
        scope: providerDef.defaultScopes.join(" "),
        state,
      });

      const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
      return NextResponse.json({ url });
    }

    // Future: handle other providers (Google, Linear, Slack, Discord)
    return NextResponse.json(
      { error: `Direct OAuth not yet implemented for ${provider}` },
      { status: 400 }
    );
  } catch (err) {
    console.error("[integrations/connect] Error:", err);
    return NextResponse.json(
      { error: "Failed to initiate connection" },
      { status: 500 }
    );
  }
}
