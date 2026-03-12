import { type NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import type { IntegrationProviderId } from "@/lib/integrations/types";

/**
 * GET /api/integrations/callback?provider=github&code=...
 * Handles the OAuth redirect after provider authorization.
 * Extracts the provider token and persists it to fp_connected_accounts.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") as IntegrationProviderId | null;
  const code = searchParams.get("code");
  const origin = new URL(request.url).origin;

  // Default redirect on success
  const successUrl = new URL(`${origin}/settings?integration=${provider}&status=connected`);
  const errorUrl = new URL(`${origin}/settings?integration=${provider}&status=error`);

  if (!provider) {
    errorUrl.searchParams.set("message", "missing_provider");
    return NextResponse.redirect(errorUrl);
  }

  const supabase = await createServerClient();

  // Exchange code for session if present (PKCE flow)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error(`[integrations/callback] PKCE exchange failed:`, error.message);
      errorUrl.searchParams.set("message", "auth_exchange_failed");
      return NextResponse.redirect(errorUrl);
    }
  }

  // Get the current user + their identities
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    errorUrl.searchParams.set("message", "not_authenticated");
    return NextResponse.redirect(errorUrl);
  }

  // Map our provider IDs to Supabase identity provider names
  const identityProviderMap: Record<string, string> = {
    github: "github",
    google: "google",
    linear: "linear",
    slack: "slack_oidc",
    discord: "discord",
  };

  const identityProvider = identityProviderMap[provider];

  // Find the matching identity from the user's linked identities
  const identity = user.identities?.find(
    (i) => i.provider === identityProvider
  );

  if (!identity) {
    console.error(`[integrations/callback] No ${provider} identity found for user ${user.id}`);
    errorUrl.searchParams.set("message", "identity_not_found");
    return NextResponse.redirect(errorUrl);
  }

  // Extract provider details from identity metadata
  const providerUserId = identity.id;
  const displayLabel =
    (identity.identity_data?.user_name as string) ??
    (identity.identity_data?.full_name as string) ??
    (identity.identity_data?.email as string) ??
    provider;

  // Persist the connected account using admin client (bypasses RLS for token storage)
  const admin = createAdminClient();

  const { error: upsertError } = await admin
    .from("fp_connected_accounts")
    .upsert(
      {
        user_id: user.id,
        provider,
        provider_user_id: providerUserId,
        display_label: displayLabel,
        scopes: [], // Will be populated when user selects scopes
        // Note: access_token from identity is managed by Supabase auth.
        // For server-side API calls, we'll use supabase.auth.getSession()
        // to get the provider token on demand.
        access_token: "__managed_by_supabase_auth__",
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );

  if (upsertError) {
    console.error(`[integrations/callback] Upsert error:`, upsertError.message);
    errorUrl.searchParams.set("message", "save_failed");
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(successUrl);
}
