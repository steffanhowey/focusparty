"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/useCurrentUser";
import {
  listConnectedAccounts,
  disconnectAccount,
  listScopes,
  toggleScope as toggleScopeApi,
} from "./accounts";
import type {
  ConnectedAccount,
  IntegrationProviderId,
  IntegrationScope,
} from "./types";

export function useConnectedAccounts() {
  const { userId } = useCurrentUser();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [scopes, setScopes] = useState<Map<string, IntegrationScope[]>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<IntegrationProviderId | null>(
    null
  );

  /* ─── Fetch accounts ──────────────────────────────────── */

  const fetchAccounts = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await listConnectedAccounts();
      setAccounts(data);
    } catch (err) {
      console.error("Failed to fetch connected accounts:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchAccounts();
  }, [userId, fetchAccounts]);

  /* ─── Realtime subscription ───────────────────────────── */

  useEffect(() => {
    if (!userId) return;

    const client = createClient();
    const channel = client
      .channel(`connected-accounts-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fp_connected_accounts",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Refetch on any change (INSERT, UPDATE, DELETE)
          fetchAccounts();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [userId, fetchAccounts]);

  /* ─── Derived state ───────────────────────────────────── */

  const isConnected = useCallback(
    (provider: IntegrationProviderId): boolean =>
      accounts.some((a) => a.provider === provider && a.status === "active"),
    [accounts]
  );

  const getAccount = useCallback(
    (provider: IntegrationProviderId): ConnectedAccount | undefined =>
      accounts.find((a) => a.provider === provider),
    [accounts]
  );

  const connectedProviders = useMemo(
    () =>
      accounts
        .filter((a) => a.status === "active")
        .map((a) => a.provider),
    [accounts]
  );

  /* ─── Connect ─────────────────────────────────────────── */

  const connect = useCallback(
    async (provider: IntegrationProviderId) => {
      setConnecting(provider);
      try {
        // Ask server for the direct OAuth authorize URL
        const res = await fetch("/api/integrations/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        });
        const data = await res.json();

        if (data.url) {
          window.location.href = data.url;
        } else {
          console.error("[connect] No OAuth URL returned:", data.error);
          setConnecting(null);
        }
      } catch (err) {
        console.error("Failed to initiate connection:", err);
        setConnecting(null);
      }
    },
    []
  );

  /* ─── Disconnect ──────────────────────────────────────── */

  const disconnect = useCallback(
    async (provider: IntegrationProviderId) => {
      const account = accounts.find((a) => a.provider === provider);
      if (!account) return;

      // Optimistic remove
      setAccounts((prev) => prev.filter((a) => a.id !== account.id));
      setScopes((prev) => {
        const next = new Map(prev);
        next.delete(account.id);
        return next;
      });

      try {
        await fetch("/api/integrations/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        });
      } catch {
        // Revert on failure
        fetchAccounts();
      }
    },
    [accounts, fetchAccounts]
  );

  /* ─── Scopes ──────────────────────────────────────────── */

  const fetchScopes = useCallback(async (accountId: string) => {
    try {
      const data = await listScopes(accountId);
      setScopes((prev) => new Map(prev).set(accountId, data));
    } catch (err) {
      console.error("Failed to fetch scopes:", err);
    }
  }, []);

  const toggleScope = useCallback(
    async (scopeId: string, accountId: string, enabled: boolean) => {
      // Optimistic update
      setScopes((prev) => {
        const next = new Map(prev);
        const accountScopes = next.get(accountId) ?? [];
        next.set(
          accountId,
          accountScopes.map((s) =>
            s.id === scopeId ? { ...s, enabled } : s
          )
        );
        return next;
      });

      try {
        await toggleScopeApi(scopeId, enabled);
      } catch {
        fetchScopes(accountId);
      }
    },
    [fetchScopes]
  );

  return {
    accounts,
    loading,
    connecting,
    isConnected,
    getAccount,
    connectedProviders,
    connect,
    disconnect,
    scopes,
    fetchScopes,
    toggleScope,
    refetch: fetchAccounts,
  };
}
