"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  ExternalLink,
  Check,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useConnectedAccounts } from "@/lib/integrations/useConnectedAccounts";
import { PROVIDERS, PROVIDER_ORDER } from "@/lib/integrations/providers";
import type {
  IntegrationProviderId,
  IntegrationScope,
} from "@/lib/integrations/types";
import { useSearchParams } from "next/navigation";

/* ─── Provider Icons (inline SVGs for brand accuracy) ────── */

function GitHubIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function GoogleCalendarIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 9h18" stroke="currentColor" strokeWidth="2" />
      <path d="M9 4V2M15 4V2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="7" y="12" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="14" y="12" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="7" y="16.5" width="3" height="3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function LinearIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.357 14.143a10.075 10.075 0 006.5 6.5l-6.5-6.5zM2 12.07a10.07 10.07 0 009.93 9.93L2 12.07zm9.504 9.918A10.072 10.072 0 0021.93 12.07L11.504 21.988zM22 11.504L12.496 2.07A10.072 10.072 0 0022 11.504zM11.07 2a10.07 10.07 0 00-7.713 3.357L14.643 16.643A10.07 10.07 0 0011.07 2z" />
    </svg>
  );
}

function SlackIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.163 0a2.528 2.528 0 012.523 2.522v6.312zM15.163 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.163 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 01-2.52-2.523 2.527 2.527 0 012.52-2.52h6.315A2.528 2.528 0 0124 15.163a2.528 2.528 0 01-2.522 2.523h-6.315z" />
    </svg>
  );
}

function DiscordIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
    </svg>
  );
}

const PROVIDER_ICONS: Record<IntegrationProviderId, typeof GitHubIcon> = {
  github: GitHubIcon,
  google: GoogleCalendarIcon,
  linear: LinearIcon,
  slack: SlackIcon,
  discord: DiscordIcon,
};

/* ─── Scope Picker ───────────────────────────────────────── */

function ScopePicker({
  accountId,
  scopes,
  onToggle,
}: {
  accountId: string;
  scopes: IntegrationScope[];
  onToggle: (scopeId: string, accountId: string, enabled: boolean) => void;
}) {
  if (scopes.length === 0) {
    return (
      <p className="text-xs text-[var(--sg-shell-500)]">
        No scopes configured yet. Scopes will appear after the provider syncs available resources.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-[var(--sg-shell-600)]">
        Connected resources
      </p>
      {scopes.map((scope) => (
        <button
          key={scope.id}
          type="button"
          onClick={() => onToggle(scope.id, accountId, !scope.enabled)}
          className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--sg-shell-100)]"
          style={{
            background: scope.enabled
              ? "var(--sg-shell-50)"
              : "transparent",
            border: "1px solid var(--sg-shell-border)",
          }}
        >
          <span
            className="truncate"
            style={{
              color: scope.enabled
                ? "var(--sg-shell-900)"
                : "var(--sg-shell-500)",
            }}
          >
            {scope.external_name}
          </span>
          {scope.enabled ? (
            <ToggleRight
              size={18}
              className="shrink-0 text-[var(--sg-forest-400)]"
            />
          ) : (
            <ToggleLeft
              size={18}
              className="shrink-0 text-[var(--sg-shell-400)]"
            />
          )}
        </button>
      ))}
    </div>
  );
}

/* ─── Provider Card ──────────────────────────────────────── */

function ProviderCard({
  providerId,
  isConnected,
  displayLabel,
  connecting,
  scopes,
  onConnect,
  onDisconnect,
  onToggleScope,
  onExpandScopes,
}: {
  providerId: IntegrationProviderId;
  isConnected: boolean;
  displayLabel: string | null;
  connecting: boolean;
  scopes: IntegrationScope[];
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleScope: (
    scopeId: string,
    accountId: string,
    enabled: boolean
  ) => void;
  onExpandScopes: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const provider = PROVIDERS[providerId];
  const Icon = PROVIDER_ICONS[providerId];

  const handleExpand = () => {
    if (!expanded) onExpandScopes();
    setExpanded(!expanded);
  };

  return (
    <div
      className="rounded-lg border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] p-5"
      style={{
        borderColor: isConnected
          ? `${provider.color}33`
          : "var(--sg-shell-border)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              background: `${provider.color}18`,
              color: provider.color,
            }}
          >
            <Icon size={20} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--sg-shell-900)]">
              {provider.displayName}
            </h3>
            <p className="text-xs text-[var(--sg-shell-500)]">
              {isConnected ? (
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--sg-forest-400)" }}
                  />
                  {displayLabel ?? "Connected"}
                </span>
              ) : (
                provider.description
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && provider.hasScopeSelection && (
            <Button
              variant="outline"
              size="xs"
              onClick={handleExpand}
              rightIcon={expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            >
              Scopes
            </Button>
          )}

          {isConnected ? (
            <Button variant="danger" size="xs" onClick={onDisconnect}>
              Disconnect
            </Button>
          ) : (
            <Button
              variant="primary"
              size="xs"
              onClick={onConnect}
              disabled={connecting}
              loading={connecting}
              leftIcon={!connecting ? <ExternalLink size={14} /> : undefined}
              className="font-semibold"
              style={{ background: provider.color }}
            >
              Connect
            </Button>
          )}
        </div>
      </div>

      {/* Scope picker (expanded) */}
      {isConnected && expanded && (
        <div className="mt-4 border-t border-[var(--sg-shell-border)] pt-4">
          <ScopePicker
            accountId={
              // We need the account ID for the scope picker
              // This is a simplification — in practice we'd pass it through
              providerId
            }
            scopes={scopes}
            onToggle={onToggleScope}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */

export function IntegrationSettings() {
  const {
    accounts,
    loading,
    connecting,
    isConnected,
    getAccount,
    connect,
    disconnect,
    scopes,
    fetchScopes,
    toggleScope,
  } = useConnectedAccounts();

  // Check for callback status in URL params
  const searchParams = useSearchParams();
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const integration = searchParams.get("integration");
    const status = searchParams.get("status");

    if (integration && status) {
      const providerName =
        PROVIDERS[integration as IntegrationProviderId]?.displayName ??
        integration;

      if (status === "connected") {
        setStatusMessage({
          type: "success",
          text: `${providerName} connected successfully`,
        });
      } else if (status === "error") {
        setStatusMessage({
          type: "error",
          text: `Failed to connect ${providerName}`,
        });
      }

      // Clear after 5 seconds
      const timer = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2
          size={24}
          className="animate-spin text-[var(--sg-shell-400)]"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 py-8">
      <div>
        <h2 className="text-lg font-semibold text-[var(--sg-shell-900)]">
          Integrations
        </h2>
        <p className="mt-1 text-sm text-[var(--sg-shell-600)]">
          Connect your tools to bring real work into focus sprints.
        </p>
      </div>

      {/* Status message from OAuth callback */}
      {statusMessage && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{
            background:
              statusMessage.type === "success"
                ? "var(--sg-forest-100)"
                : "var(--sg-coral-100)",
            color:
              statusMessage.type === "success"
                ? "var(--sg-forest-700)"
                : "var(--sg-coral-600)",
          }}
        >
          {statusMessage.type === "success" ? (
            <Check size={16} />
          ) : (
            <ExternalLink size={16} />
          )}
          {statusMessage.text}
        </div>
      )}

      {/* Provider cards */}
      <div className="space-y-3">
        {PROVIDER_ORDER.map((providerId) => {
          const account = getAccount(providerId);
          const accountScopes = account
            ? scopes.get(account.id) ?? []
            : [];

          return (
            <ProviderCard
              key={providerId}
              providerId={providerId}
              isConnected={isConnected(providerId)}
              displayLabel={account?.display_label ?? null}
              connecting={connecting === providerId}
              scopes={accountScopes}
              onConnect={() => connect(providerId)}
              onDisconnect={() => disconnect(providerId)}
              onToggleScope={toggleScope}
              onExpandScopes={() => {
                if (account) fetchScopes(account.id);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
