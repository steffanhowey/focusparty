// ─── Integration Provider Types ─────────────────────────────────

export type IntegrationProviderId =
  | "github"
  | "google"
  | "linear"
  | "slack"
  | "discord";

export interface IntegrationProviderDef {
  id: IntegrationProviderId;
  displayName: string;
  description: string;
  /** Hex color for branding */
  color: string;
  /** Default OAuth scopes to request */
  defaultScopes: string[];
  /** Whether this provider supports scope selection (repo picker, etc.) */
  hasScopeSelection: boolean;
  /** Scope types this provider uses (e.g., 'repo', 'org' for GitHub) */
  scopeTypes: string[];
}

// ─── Connected Account ──────────────────────────────────────────

export type AccountStatus = "active" | "revoked" | "expired";

export interface ConnectedAccount {
  id: string;
  user_id: string;
  provider: IntegrationProviderId;
  provider_user_id: string;
  provider_workspace_id: string | null;
  display_label: string | null;
  scopes: string[];
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

// ─── Integration Scopes ─────────────────────────────────────────

export type ScopeAccessLevel = "read" | "write";

export interface IntegrationScope {
  id: string;
  connected_account_id: string;
  scope_type: string;
  external_id: string;
  external_name: string;
  access_level: ScopeAccessLevel;
  enabled: boolean;
  created_at: string;
}

// ─── Linked Resources ───────────────────────────────────────────

export type ResourceType = "issue" | "pr" | "linear_issue" | "calendar_event";

export interface LinkedResource {
  id: string;
  user_id: string;
  provider: IntegrationProviderId;
  resource_type: ResourceType;
  external_id: string;
  external_parent_id: string | null;
  title: string;
  url: string | null;
  status: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  cached_at: string;
}

// ─── External Work Items (normalized from providers) ────────────

export interface ExternalWorkItem {
  externalId: string;
  provider: IntegrationProviderId;
  resourceType: ResourceType;
  title: string;
  url: string;
  /** Provider-specific: repo, labels, priority, state, etc. */
  metadata: Record<string, unknown>;
}

// ─── Sprint Links ───────────────────────────────────────────────

export type WritebackMode = "manual" | "suggest_only" | "auto_on_confirm";

export interface SprintLink {
  id: string;
  session_id: string;
  resource_id: string;
  writeback_mode: WritebackMode;
  status_snapshot: Record<string, unknown>;
  created_at: string;
}

// ─── Writeback ──────────────────────────────────────────────────

export type WritebackAction =
  | "comment"
  | "status_update"
  | "slack_post"
  | "discord_post";

export interface WritebackPayload {
  action: WritebackAction;
  body?: string;
  newStatus?: string;
}

export interface IntegrationWriteback {
  id: string;
  user_id: string;
  session_id: string | null;
  provider: IntegrationProviderId;
  resource_id: string | null;
  action_type: WritebackAction;
  payload: Record<string, unknown>;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

// ─── Notification Channels ──────────────────────────────────────

export interface NotificationChannel {
  id: string;
  user_id: string;
  provider: "slack" | "discord";
  channel_id: string;
  channel_name: string;
  is_default: boolean;
  notify_on: string[];
  created_at: string;
}

// ─── Provider Adapter Interface ─────────────────────────────────

export interface TaskSourceAdapter {
  provider: IntegrationProviderId;
  fetchItems(accessToken: string, scopes: IntegrationScope[]): Promise<ExternalWorkItem[]>;
  writeBack(
    accessToken: string,
    externalId: string,
    payload: WritebackPayload
  ): Promise<void>;
}
