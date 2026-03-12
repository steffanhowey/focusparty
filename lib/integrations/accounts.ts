import { createClient } from "@/lib/supabase/client";
import type {
  ConnectedAccount,
  IntegrationProviderId,
  IntegrationScope,
} from "./types";

/* ─── Read ───────────────────────────────────────────────── */

export async function listConnectedAccounts(): Promise<ConnectedAccount[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fp_connected_accounts")
    .select("id, user_id, provider, provider_user_id, provider_workspace_id, display_label, scopes, status, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ConnectedAccount[];
}

export async function getConnectedAccount(
  provider: IntegrationProviderId
): Promise<ConnectedAccount | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fp_connected_accounts")
    .select("id, user_id, provider, provider_user_id, provider_workspace_id, display_label, scopes, status, created_at, updated_at")
    .eq("provider", provider)
    .maybeSingle();

  if (error) throw error;
  return data as ConnectedAccount | null;
}

/* ─── Delete (disconnect) ────────────────────────────────── */

export async function disconnectAccount(
  accountId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fp_connected_accounts")
    .delete()
    .eq("id", accountId);

  if (error) throw error;
}

/* ─── Scopes ─────────────────────────────────────────────── */

export async function listScopes(
  accountId: string
): Promise<IntegrationScope[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fp_integration_scopes")
    .select("*")
    .eq("connected_account_id", accountId)
    .order("external_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as IntegrationScope[];
}

export async function toggleScope(
  scopeId: string,
  enabled: boolean
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fp_integration_scopes")
    .update({ enabled })
    .eq("id", scopeId);

  if (error) throw error;
}

export async function updateScopeAccessLevel(
  scopeId: string,
  accessLevel: "read" | "write"
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fp_integration_scopes")
    .update({ access_level: accessLevel })
    .eq("id", scopeId);

  if (error) throw error;
}
