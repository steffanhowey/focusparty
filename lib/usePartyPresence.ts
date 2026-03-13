"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "./supabase/client";
import { presenceChannelName, buildPresencePayload } from "./presence";
import type {
  PresencePayload,
  SessionPhase,
  CharacterId,
  CommitmentType,
} from "./types";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UsePartyPresenceInput {
  partyId: string | null;
  userId: string | null;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  character?: CharacterId | null;
  activeSessionId?: string | null;
  phase?: SessionPhase | null;
  goalPreview?: string | null;
  commitmentType?: CommitmentType | null;
  sprintStartedAt?: string | null;
  sprintDurationSec?: number | null;
  breakContentId?: string | null;
  breakContentTitle?: string | null;
  breakContentThumbnail?: string | null;
}

interface UsePartyPresenceReturn {
  /** Deduplicated list of online participants. */
  participants: PresencePayload[];
  /** Number of unique online users. */
  count: number;
  /** Whether the local user has successfully tracked. */
  isTracking: boolean;
  /** Force re-track with updated payload fields. */
  updatePresence: (updates: Partial<PresencePayload>) => void;
}

/**
 * Manages a Supabase Presence channel for a party.
 * Tracks the local user and listens for sync events from all participants.
 */
export function usePartyPresence(
  input: UsePartyPresenceInput
): UsePartyPresenceReturn {
  const {
    partyId,
    userId,
    displayName,
    username,
    avatarUrl,
    character,
    activeSessionId,
    phase,
    goalPreview,
    commitmentType,
    sprintStartedAt,
    sprintDurationSec,
    breakContentId,
    breakContentTitle,
    breakContentThumbnail,
  } = input;

  const [participants, setParticipants] = useState<PresencePayload[]>([]);
  const [isTracking, setIsTracking] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Deduplicate presence entries by userId (latest updatedAt wins)
  const processPresenceState = useCallback(
    (presenceState: Record<string, { [key: string]: unknown }[]>) => {
      const byUser = new Map<string, PresencePayload>();

      for (const entries of Object.values(presenceState)) {
        for (const entry of entries) {
          const payload = entry as unknown as PresencePayload;
          if (!payload.userId) continue;
          const existing = byUser.get(payload.userId);
          if (!existing || payload.updatedAt > existing.updatedAt) {
            byUser.set(payload.userId, payload);
          }
        }
      }

      return Array.from(byUser.values());
    },
    []
  );

  // Subscribe to presence channel
  useEffect(() => {
    if (!partyId || !userId) return;

    const client = createClient();
    const channelName = presenceChannelName(partyId);
    const channel = client.channel(channelName);

    channel
      .on("presence", { event: "sync" }, () => {
        const presState = channel.presenceState();
        const list = processPresenceState(presState);
        setParticipants(list);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const payload = buildPresencePayload({
            userId,
            displayName,
            username,
            avatarUrl,
            character,
            activeSessionId,
            phase,
            goalPreview,
            commitmentType,
            sprintStartedAt,
            sprintDurationSec,
            breakContentId,
            breakContentTitle,
            breakContentThumbnail,
          });
          await channel.track(payload);
          setIsTracking(true);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      client.removeChannel(channel);
      channelRef.current = null;
      setParticipants([]);
      setIsTracking(false);
    };
    // Intentionally sparse deps — channel lifecycle bound to partyId/userId only.
    // Property updates handled by the re-track effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId, userId]);

  // Re-track when tracked properties actually change (skip redundant updates)
  const lastTrackedRef = useRef<string>("");
  useEffect(() => {
    if (!channelRef.current || !userId) return;

    // Build a fingerprint of the trackable fields to avoid redundant re-tracks
    const fingerprint = JSON.stringify([userId, displayName, avatarUrl, character, activeSessionId, phase, goalPreview, commitmentType, sprintStartedAt, sprintDurationSec, breakContentId, breakContentTitle, breakContentThumbnail]);
    if (fingerprint === lastTrackedRef.current) return;
    lastTrackedRef.current = fingerprint;

    const payload = buildPresencePayload({
      userId,
      displayName,
      avatarUrl,
      character,
      activeSessionId,
      phase,
      goalPreview,
      commitmentType,
      sprintStartedAt,
      sprintDurationSec,
      breakContentId,
      breakContentTitle,
      breakContentThumbnail,
    });
    channelRef.current.track(payload);
  }, [userId, displayName, username, avatarUrl, character, activeSessionId, phase, goalPreview, commitmentType, sprintStartedAt, sprintDurationSec, breakContentId, breakContentTitle, breakContentThumbnail]);

  // Ref avoids stale closure — participants changes on every sync event
  const participantsRef = useRef(participants);
  participantsRef.current = participants;

  const updatePresence = useCallback(
    (updates: Partial<PresencePayload>) => {
      if (!channelRef.current || !userId) return;
      const current = participantsRef.current.find((p) => p.userId === userId);
      const merged = {
        ...(current ?? {}),
        ...updates,
        updatedAt: new Date().toISOString(),
      } as PresencePayload;
      channelRef.current.track(merged);
    },
    [userId]
  );

  return {
    participants,
    count: participants.length,
    isTracking,
    updatePresence,
  };
}
