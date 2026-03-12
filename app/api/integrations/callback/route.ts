import { type NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import type { IntegrationProviderId } from "@/lib/integrations/types";

/**
 * GET /api/integrations/callback?code=...&state=...
 * Handles the OAuth redirect after provider authorization.
 * Exchanges the code directly with the provider (not Supabase auth),
 * then persists the access token to fp_connected_accounts.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const origin = new URL(request.url).origin;

  // Decode state to get provider and userId
  let provider: IntegrationProviderId | null = null;
  let stateUserId: string | null = null;

  if (stateParam) {
    try {
      const parsed = JSON.parse(
        Buffer.from(stateParam, "base64url").toString()
      );
      provider = parsed.provider ?? null;
      stateUserId = parsed.userId ?? null;
    } catch {
      // Fall back to query param for legacy compat
      provider = searchParams.get("provider") as IntegrationProviderId | null;
    }
  } else {
    provider = searchParams.get("provider") as IntegrationProviderId | null;
  }

  const errorUrl = new URL(
    `${origin}/settings?integration=${provider ?? "unknown"}&status=error`
  );
  const successUrl = new URL(
    `${origin}/settings?integration=${provider}&status=connected`
  );

  if (!provider || !code) {
    errorUrl.searchParams.set("message", "missing_params");
    return NextResponse.redirect(errorUrl);
  }

  // Verify the requesting user matches the state
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    errorUrl.searchParams.set("message", "not_authenticated");
    return NextResponse.redirect(errorUrl);
  }

  if (stateUserId && stateUserId !== user.id) {
    errorUrl.searchParams.set("message", "state_mismatch");
    return NextResponse.redirect(errorUrl);
  }

  // ─── GitHub direct token exchange ──────────────────────────
  if (provider === "github") {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      errorUrl.searchParams.set("message", "github_not_configured");
      return NextResponse.redirect(errorUrl);
    }

    // Exchange code for access token with GitHub
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: `${origin}/api/integrations/callback`,
        }),
      }
    );

    const tokenData = await tokenRes.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error(
        "[integrations/callback] GitHub token exchange failed:",
        tokenData.error_description ?? tokenData.error
      );
      errorUrl.searchParams.set("message", "token_exchange_failed");
      return NextResponse.redirect(errorUrl);
    }

    const accessToken = tokenData.access_token as string;

    // Fetch GitHub user info to get the display label
    const ghUserRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    let displayLabel = "GitHub User";
    let providerUserId = "unknown";

    if (ghUserRes.ok) {
      const ghUser = await ghUserRes.json();
      displayLabel = ghUser.login ?? ghUser.name ?? "GitHub User";
      providerUserId = String(ghUser.id);
    }

    // Persist the connected account
    const admin = createAdminClient();
    const { error: upsertError } = await admin
      .from("fp_connected_accounts")
      .upsert(
        {
          user_id: user.id,
          provider: "github",
          provider_user_id: providerUserId,
          display_label: displayLabel,
          scopes: tokenData.scope
            ? (tokenData.scope as string).split(",")
            : [],
          access_token: accessToken,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertError) {
      console.error(
        "[integrations/callback] Upsert error:",
        upsertError.message
      );
      errorUrl.searchParams.set("message", "save_failed");
      return NextResponse.redirect(errorUrl);
    }

    return NextResponse.redirect(successUrl);
  }

  // Future: handle other providers
  errorUrl.searchParams.set("message", "unsupported_provider");
  return NextResponse.redirect(errorUrl);
}
