"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  getParty,
  getSyntheticParticipants,
  type Party,
  type SyntheticPresenceInfo,
} from "@/lib/parties";
import {
  getPartyHostPersonality,
  getPartyRuntimeWorldKey,
  getWorldConfig,
} from "@/lib/worlds";
import { getHostConfig } from "@/lib/hosts";
import {
  getActiveBackground,
  type ActiveBackground,
} from "@/lib/roomBackgrounds";
import { getUserTimeState } from "@/lib/timeOfDay";

/**
 * Loads party data, world/host config, synthetic participants, and AI background.
 * Encapsulates all the "room setup" data fetching for the environment page.
 */
export function useEnvironmentParty(partyId: string) {
  // ─── Party + synthetics (fetched in parallel) ────────────
  const [party, setParty] = useState<Party | null>(null);
  const [partyLoading, setPartyLoading] = useState(true);
  const [syntheticParticipants, setSyntheticParticipants] = useState<
    SyntheticPresenceInfo[]
  >([]);

  useEffect(() => {
    if (!partyId) return;
    let cancelled = false;

    // Fetch party and synthetics in parallel
    Promise.all([
      getParty(partyId),
      getSyntheticParticipants(partyId),
    ])
      .then(([p, sp]) => {
        if (cancelled) return;
        setParty(p);
        setSyntheticParticipants(sp);
      })
      .catch((err) => console.error("Failed to fetch party data:", err))
      .finally(() => {
        if (!cancelled) setPartyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [partyId]);

  // ─── Synthetic participants polling (visibility-aware) ────
  const loadSynthetics = useCallback(() => {
    if (!partyId) return;
    getSyntheticParticipants(partyId)
      .then(setSyntheticParticipants)
      .catch((err) =>
        console.error("Failed to fetch synthetic participants:", err)
      );
  }, [partyId]);

  useEffect(() => {
    if (!partyId) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(loadSynthetics, 30_000);
      }
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadSynthetics(); // Refresh immediately on return
        startPolling();
      } else {
        stopPolling();
      }
    };

    // Start polling if tab is visible
    if (document.visibilityState === "visible") {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [partyId, loadSynthetics]);

  // ─── Derived config ────────────────────────────────────
  const runtimeWorldKey = getPartyRuntimeWorldKey(party);
  const world = party
    ? getWorldConfig(runtimeWorldKey)
    : getWorldConfig("default");
  const hostConfig = party
    ? getHostConfig(getPartyHostPersonality(party))
    : getHostConfig("default");

  // ─── AI background (falls back to placeholder gradient) ───
  // Lock the time state on mount so it never changes mid-session
  const lockedTimeStateRef = useRef(getUserTimeState());
  const [aiBackground, setAiBackground] = useState<ActiveBackground | null>(
    null
  );
  useEffect(() => {
    if (!runtimeWorldKey) return;
    getActiveBackground(runtimeWorldKey, lockedTimeStateRef.current)
      .then(setAiBackground)
      .catch((err) => console.error("Failed to load background:", err));
  }, [runtimeWorldKey]);

  const backgroundImageUrl = aiBackground?.publicUrl ?? null;
  const modalBackgrounds = useMemo(() => {
    if (!aiBackground) return undefined;
    return new Map([[runtimeWorldKey, aiBackground]]);
  }, [aiBackground, runtimeWorldKey]);

  return {
    party,
    partyLoading,
    syntheticParticipants,
    world,
    hostConfig,
    backgroundImageUrl,
    modalBackgrounds,
  };
}
