"use client";

import { useState, useEffect } from "react";
import { getActivePartyForUser, type Party } from "@/lib/parties";
import { useCurrentUser } from "@/lib/useCurrentUser";

export function useActiveParty() {
  const { userId } = useCurrentUser();
  const [party, setParty] = useState<Party | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const p = await getActivePartyForUser(userId!);
        if (!cancelled) setParty(p);
      } catch {
        // silent — no party found is fine
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    party,
    partyId: party?.id ?? null,
    isLoading,
  };
}
